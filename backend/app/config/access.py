# app/config/access.py
ROLE_ACCESS = {
    "admin": ["invoice", "salary", "purchase_order", "inventory"],
    "hr":    ["salary", "employee", "invoice"],
    "moderator": ["network", "infra", "purchase_order"],  # ← no "invoice"
    "user":  ["invoice", "shipping_order"],
}

ALL_GROUPS = sorted({g for groups in ROLE_ACCESS.values() for g in groups})

def groups_for_role(role_name: str) -> list[str]:
    if not role_name:
        return []
    return ROLE_ACCESS.get(role_name.lower(), [])
