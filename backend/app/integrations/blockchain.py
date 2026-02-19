import hashlib
import time


def mock_mint_badge(public_id: str, recipient_name: str) -> dict:
    """
    Sprint 2 (fase 1): mock de mint para validar fluxo end-to-end.
    Próxima etapa: substituir por chamada real ao contrato Polygon.
    """
    seed = f"{public_id}:{recipient_name}:{time.time()}".encode("utf-8")
    tx_hash = "0x" + hashlib.sha256(seed).hexdigest()
    token_id = str(int(hashlib.md5(seed).hexdigest(), 16) % 10_000_000)
    return {
        "tx_hash": tx_hash,
        "token_id": token_id,
        "network": "polygon",
        "mode": "mock",
    }
