"""
MFA service — TOTP generation, verification, QR codes, backup codes.
"""

import pyotp
import qrcode
import io
import base64
import secrets
import json
from passlib.context import CryptContext

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_mfa_secret() -> str:
    """Generate a new TOTP secret (base32)."""
    return pyotp.random_base32()


def generate_totp_uri(secret: str, email: str, issuer: str = "WorkforcePro") -> str:
    """Generate otpauth:// URI for authenticator apps."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def generate_qr_code(uri: str) -> str:
    """Generate a base64-encoded PNG QR code from a URI."""
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code with 1-step tolerance for clock drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate human-readable backup codes."""
    return [secrets.token_hex(4).upper() for _ in range(count)]


def hash_backup_codes(codes: list[str]) -> str:
    """Hash each backup code and return as JSON array."""
    hashed = [_pwd.hash(c) for c in codes]
    return json.dumps(hashed)


def verify_backup_code(stored_hashes_json: str, code: str) -> tuple[bool, str]:
    """
    Verify a backup code against stored hashes.
    Returns (valid, remaining_hashes_json). Burns the code if valid.
    """
    hashes = json.loads(stored_hashes_json)
    for i, h in enumerate(hashes):
        if _pwd.verify(code.upper(), h):
            hashes.pop(i)
            return True, json.dumps(hashes)
    return False, stored_hashes_json
