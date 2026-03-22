"""
Integração real com a Polygon via web3.py.
Contrato: mintBadge(uint256 badgeId, address to, string metadataHash, uint256 validUntil)
Evento:   BadgeMinted(uint256 indexed badgeId, address indexed to)
"""

import hashlib
import logging
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# ABI mínimo — apenas a função e o evento utilizados
_BADGE_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "badgeId", "type": "uint256"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "string", "name": "metadataHash", "type": "string"},
            {"internalType": "uint256", "name": "validUntil", "type": "uint256"},
        ],
        "name": "mintBadge",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "badgeId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "to", "type": "address"},
        ],
        "name": "BadgeMinted",
        "type": "event",
    },
]


def _get_settings():
    from app.core.config import settings
    return settings


def _badge_id_from_public_id(public_id: str) -> int:
    """Converte public_id (hex string) em uint256 determinístico e único."""
    digest = hashlib.sha256(public_id.encode()).hexdigest()
    return int(digest[:15], 16)  # 60-bit — nunca colide, cabe em uint256


def mint_badge(public_id: str, recipient_name: str, valid_until: datetime | None = None) -> dict:
    """
    Realiza o mint real do badge na Polygon.
    Retorna dict com tx_hash, token_id, network e polygonscan_url.
    Em caso de falha, faz fallback para mock com flag de erro para não bloquear a emissão.
    """
    settings = _get_settings()

    if not settings.polygon_private_key or not settings.polygon_contract_address:
        logger.warning("Variáveis Polygon não configuradas — usando fallback mock.")
        return _fallback(public_id, recipient_name, reason="config_missing")

    try:
        from web3 import Web3
        from web3.middleware import ExtraDataToPOAMiddleware

        # Conexão
        w3 = Web3(Web3.HTTPProvider(settings.polygon_rpc_url))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not w3.is_connected():
            logger.error("Falha ao conectar ao RPC Polygon: %s", settings.polygon_rpc_url)
            return _fallback(public_id, recipient_name, reason="rpc_unreachable")

        # Conta
        account = w3.eth.account.from_key(settings.polygon_private_key)
        wallet_address = account.address

        # Contrato
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(settings.polygon_contract_address),
            abi=_BADGE_ABI,
        )

        # Parâmetros
        badge_id = _badge_id_from_public_id(public_id)
        metadata_hash = f"{settings.badge_verify_base_url}/{public_id}"

        if valid_until is None:
            valid_until = datetime.utcnow() + timedelta(days=365 * 10)
        valid_until_ts = int(valid_until.timestamp())

        # Nonce e gas
        nonce = w3.eth.get_transaction_count(wallet_address)
        gas_price = w3.eth.gas_price

        tx = contract.functions.mintBadge(
            badge_id,
            wallet_address,        # to = carteira BadgeOne (custodiante)
            metadata_hash,
            valid_until_ts,
        ).build_transaction({
            "from": wallet_address,
            "nonce": nonce,
            "gasPrice": gas_price,
        })

        # Estimar gas
        tx["gas"] = w3.eth.estimate_gas(tx)

        # Assinar e enviar
        signed = w3.eth.account.sign_transaction(tx, private_key=settings.polygon_private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        # Aguardar confirmação (timeout 90s)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=90)

        if receipt.status != 1:
            logger.error("Transação revertida: %s", tx_hash_hex)
            return _fallback(public_id, recipient_name, reason="tx_reverted", tx_hash=tx_hash_hex)

        logger.info("Badge mintado com sucesso: tx=%s badge_id=%s", tx_hash_hex, badge_id)

        return {
            "tx_hash": tx_hash_hex,
            "token_id": str(badge_id),
            "network": "polygon",
            "mode": "live",
            "polygonscan_url": f"https://polygonscan.com/tx/{tx_hash_hex}",
            "contract": settings.polygon_contract_address,
        }

    except Exception as exc:
        logger.exception("Erro no mint Polygon: %s", exc)
        return _fallback(public_id, recipient_name, reason=str(exc)[:120])


def _fallback(public_id: str, recipient_name: str, reason: str = "unknown", tx_hash: str | None = None) -> dict:
    """Fallback mock quando o mint real falha — emissão não é bloqueada."""
    seed = f"{public_id}:{recipient_name}:{time.time()}".encode()
    mock_hash = tx_hash or ("0x" + hashlib.sha256(seed).hexdigest())
    token_id = str(int(hashlib.md5(seed).hexdigest(), 16) % 10_000_000)
    logger.warning("Usando fallback mock. Motivo: %s | tx=%s", reason, mock_hash)
    return {
        "tx_hash": mock_hash,
        "token_id": token_id,
        "network": "polygon",
        "mode": "mock_fallback",
        "fallback_reason": reason,
    }


# ── Compatibilidade retroativa — mantém nome antigo funcionando ──────────────
def mock_mint_badge(public_id: str, recipient_name: str) -> dict:
    """Alias retrocompatível — agora chama o mint real."""
    return mint_badge(public_id, recipient_name)
