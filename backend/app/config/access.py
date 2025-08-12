# app/config/access.py

# Which groups each role may access (in addition to the user's own docs)
ROLE_ACCESS = {
    "admin": ["invoice", "salary", "purchase_order", "inventory"],
    "hr":    ["salary", "employee", "invoice"],
    "it":    ["network", "infra", "purchase_order"],
    "user":  ["invoice", "shipping_order"],
}

# Convenience: flattened list of all known groups (for validation)
ALL_GROUPS = sorted({g for groups in ROLE_ACCESS.values() for g in groups})

def groups_for_role(role_name: str) -> list[str]:
    """Return the allowed groups for a given role name (case-insensitive)."""
    if not role_name:
        return []
    return ROLE_ACCESS.get(role_name.lower(), [])
