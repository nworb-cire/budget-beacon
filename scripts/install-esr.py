#!/usr/bin/env python3
"""Install Budget Beacon through Linux's system Firefox policy, not a test profile.

Without --apply this prints a reviewable plan and changes nothing. --allow-unsigned
is an explicit opt-in to lowering the ESR add-on signing requirement.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from datetime import datetime, timezone
import zipfile

ADDON_ID = 'budget-beacon@local.prototype'
DEFAULT_POLICY = Path('/etc/firefox/policies/policies.json')
DEFAULT_INSTALL = Path('/usr/local/share/budget-beacon')


def package(source):
    files = sorted(p for p in source.rglob('*') if p.is_file())
    digest = hashlib.sha256()
    for file in files:
        digest.update(str(file.relative_to(source)).encode())
        digest.update(file.read_bytes())
    return digest.hexdigest()[:16], files


def merge_policy(existing, install_url, allow_unsigned):
    result = copy.deepcopy(existing)
    policies = result.setdefault('policies', {})
    extensions = policies.setdefault('ExtensionSettings', {})
    entry = extensions.setdefault(ADDON_ID, {})
    entry.update({'installation_mode': 'normal_installed', 'install_url': install_url, 'default_area': 'navbar'})
    if allow_unsigned:
        policies.setdefault('Preferences', {})['xpinstall.signatures.required'] = {'Value': False, 'Status': 'locked'}
    return result


def atomic_write(target, data):
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
        handle.write(data)
        name = handle.name
    os.chmod(name, 0o644)
    os.replace(name, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write system files (requires sudo).')
    parser.add_argument('--allow-unsigned', action='store_true', help='Allow unsigned add-ons in ESR across profiles.')
    parser.add_argument('--xpi', type=Path, help='Use a Mozilla-signed XPI instead of the unsigned local source.')
    parser.add_argument('--policy-path', type=Path, default=DEFAULT_POLICY, help=argparse.SUPPRESS)
    parser.add_argument('--install-dir', type=Path, default=DEFAULT_INSTALL, help=argparse.SUPPRESS)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent.parent / 'extension'
    if args.xpi:
        data = args.xpi.read_bytes()
        with zipfile.ZipFile(args.xpi) as archive:
            manifest = json.loads(archive.read('manifest.json'))
        digest, files = hashlib.sha256(data).hexdigest()[:16], None
    else:
        if not args.allow_unsigned:
            parser.error('The local prototype is unsigned. Use --allow-unsigned explicitly, or supply a signed --xpi.')
        manifest = json.loads((source / 'manifest.json').read_text())
        digest, files = package(source)
    if manifest['browser_specific_settings']['gecko']['id'] != ADDON_ID:
        parser.error('The package does not contain Budget Beacon.')
    target = args.install_dir.resolve() / f'budget-beacon-{digest}.xpi'
    existing = json.loads(args.policy_path.read_text()) if args.policy_path.exists() else {}
    policy = merge_policy(existing, target.as_uri(), args.allow_unsigned)
    print(f'Package: {target}\nPolicy: {args.policy_path}\nAll native Linux Firefox ESR profiles will install this add-on on startup.')
    if args.allow_unsigned:
        print('Signature verification: disabled in ESR across profiles (explicit --allow-unsigned opt-in).')
    print(json.dumps(policy, indent=2))
    if not args.apply:
        print('Plan only. No system files changed. Add --apply with sudo to install.')
        return
    if os.geteuid() != 0:
        parser.error('--apply requires sudo because the installation is system-wide.')
    if files is not None:
        with tempfile.TemporaryDirectory() as tmp:
            staged = Path(tmp) / 'budget-beacon.xpi'
            with zipfile.ZipFile(staged, 'w', zipfile.ZIP_DEFLATED) as archive:
                for file in files:
                    archive.write(file, file.relative_to(source))
            data = staged.read_bytes()
    atomic_write(target, data)
    if args.policy_path.exists():
        suffix = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = args.policy_path.with_name(args.policy_path.name + f'.budget-beacon-backup-{suffix}')
        shutil.copy2(args.policy_path, backup)
        print(f'Existing policy backed up to {backup}')
    atomic_write(args.policy_path, (json.dumps(policy, indent=2) + '\n').encode())
    print('Installed. Fully quit and reopen your normal Firefox ESR. No new browser profile is created.')
    print('Verify Budget Beacon in about:addons and policy status in about:policies.')


if __name__ == '__main__':
    main()
