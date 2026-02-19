import json
import hashlib


def mock_pin_metadata(payload: dict) -> str:
    """
    Sprint 2 (fase 1): mock de pin no IPFS.
    Próxima etapa: integrar Pinata/Web3.storage.
    """
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    cid = hashlib.sha1(raw).hexdigest()
    return f"ipfs://{cid}"
