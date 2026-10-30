#!/usr/bin/env python3
"""Read only the authorised consent record; never copy the cookie store."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct

SOURCE = Path('/Users/eric/Library/Developer/CoreSimulator/Devices/11E7AF04-6698-4DBC-987F-042FFB5AB210/data/Containers/Data/Application/319BF668-E343-4217-A2C2-9047FC4378CD/Library/Cookies/Cookies.binarycookies')
DOMAINS = (b'bestlawyers.com', b'www.bestlawyers.com', b'.bestlawyers.com')
NAME = b'bl_cookie_policy_V4'


def require(condition, label):
    if not condition:
        raise ValueError(label)


def u32(data, offset, endian='<'):
    require(0 <= offset <= len(data) - 4, 'Integer field outside bounds')
    return struct.unpack_from(endian + 'I', data, offset)[0]


def parse(data):
    require(len(data) >= 8 and data[:4] == b'cook', 'Unsupported cookie file magic')
    count = u32(data, 4, '>')
    require(count <= 100000 and 8 + 4 * count <= len(data), 'Page table outside bounds')
    sizes = [u32(data, 8 + 4 * i, '>') for i in range(count)]
    require(sum(sizes) <= len(data) - (8 + 4 * count), 'Pages exceed file bounds')
    position = 8 + 4 * count
    matches, pages = [], []
    for page_index, size in enumerate(sizes):
        page, page_file_offset = data[position:position + size], position
        position += size
        pages.append(page)
        require(len(page) >= 12 and page[:4] == b'\x00\x00\x01\x00', 'Unsupported page signature or size')
        count = u32(page, 4)
        header_end = 12 + 4 * count
        require(count <= 100000 and header_end <= len(page), 'Record table outside page bounds')
        require(page[8 + 4 * count:header_end] == b'\x00' * 4, 'Unsupported page-table footer')
        offsets = [u32(page, 8 + 4 * i) for i in range(count)]
        require(len(set(offsets)) == count, 'Duplicate record offsets')
        regions = []
        for record_index, offset in enumerate(offsets):
            require(header_end <= offset <= len(page) - 56, 'Record header outside page bounds')
            size = u32(page, offset)
            require(size >= 56 and offset + size <= len(page), 'Record outside page bounds')
            regions.append((offset, offset + size))
            record = page[offset:offset + size]
            fields = [u32(record, index) for index in (16, 20, 24, 28)]
            for field in fields:
                require(56 <= field < size, 'Record string offset outside bounds')
                require(record.find(b'\x00', field) >= 0, 'Record string missing terminator')

            def string_at(field):
                return record[field:record.find(b'\x00', field)]

            # No unrelated values are decoded, printed or written. Only domain/name select.
            domain, name = string_at(fields[0]), string_at(fields[1])
            if domain in DOMAINS and name == NAME:
                flags = u32(record, 8)
                matches.append({
                    'name': NAME.decode('ascii'), 'domain': domain.decode('ascii'),
                    'path': string_at(fields[2]).decode('utf-8', errors='strict'),
                    'value': string_at(fields[3]).decode('utf-8', errors='strict'),
                    'flags': {'raw': flags, 'hex': f'0x{flags:08x}', 'secure': bool(flags & 1),
                              'httpOnly': bool(flags & 4), 'otherBits': flags & ~5},
                    'recordLocation': {'pageIndex': page_index, 'recordIndex': record_index,
                                       'fileOffset': page_file_offset + offset, 'recordBytes': size},
                })
        regions.sort()
        require(all(a[1] <= b[0] for a, b in zip(regions, regions[1:])), 'Overlapping cookie records')
    checksum = None
    if len(data) - position >= 4:
        checksum = u32(data, position, '>') == (sum(sum(page[::4]) for page in pages) & 0xffffffff)
    return matches, checksum, len(data) - position


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--phase', choices=['baseline', 'after'], required=True)
    phase = args.parse_args().phase
    now = datetime.now(timezone.utc)
    with SOURCE.open('rb') as file:
        before = os.fstat(file.fileno())
        require(before.st_size <= 64 * 1024 * 1024, 'Cookie file exceeds scoped parser size bound')
        data = file.read()
        after = os.fstat(file.fileno())
    path_after = SOURCE.stat()
    identity = lambda value: (value.st_ino, value.st_size, value.st_mtime_ns)
    stable = identity(before) == identity(after) == identity(path_after)
    matches, checksum, trailing = parse(data)
    report = {
        'version': 1, 'observation': 'read-only native Safari persisted-cookie ' + phase,
        'observedAtUtc': now.isoformat().replace('+00:00', 'Z'),
        'simulatorId': '11E7AF04-6698-4DBC-987F-042FFB5AB210', 'sourcePath': str(SOURCE),
        'sourceBytes': len(data), 'sourceSha256': hashlib.sha256(data).hexdigest(),
        'sourceMtimeUtc': datetime.fromtimestamp(before.st_mtime, timezone.utc).isoformat().replace('+00:00', 'Z'),
        'sourceStableDuringRead': stable,
        'parseValidation': {'magic': 'cook', 'allPageSignaturesValid': True,
                            'allPageAndRecordBoundsValid': True,
                            'allRequiredStringOffsetsAndTerminatorsValid': True,
                            'nonoverlappingRecords': True,
                            'pageChecksumMatchesDocumentedEveryFourthByteSum': checksum,
                            'trailingBytesNotInterpreted': trailing},
        'filter': {'name': NAME.decode('ascii'), 'domains': [value.decode('ascii') for value in DOMAINS]},
        'records': matches,
        'parserSourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'formatSources': ['https://github.com/interstateone/BinaryCookies#file-format',
                          'https://github.com/libyal/dtformats/blob/main/documentation/Safari%20Cookies.asciidoc'],
        'limitations': [
            'This is the on-disk file snapshot, not document.cookie or a remote-inspector observation.',
            'Safari may not yet have flushed live cookies; absence proves absence only from this parsed disk snapshot.',
            'The primary supplies switch/page context; this read does not observe switch state or attribute writes.',
            'Persisted cookie values do not establish server-side consent enforcement or tracking prevention.',
            'No other cookie values were decoded, emitted or copied. No full cookie file copy was made.',
        ],
    }
    output = Path(__file__).parent / ('bestlawyers-duo-cookie-' + phase + '-' + now.strftime('%Y%m%dT%H%M%S.%fZ') + '.json')
    with output.open('x') as file:
        json.dump(report, file, indent=2)
        file.write('\n')
    print(json.dumps({'artifact': str(output.resolve()), 'observedAtUtc': report['observedAtUtc'],
                      'sourceMtimeUtc': report['sourceMtimeUtc'], 'sourceStableDuringRead': stable,
                      'allBoundsValid': True, 'checksumMatches': checksum, 'records': matches}, indent=2))


if __name__ == '__main__':
    main()
