"""
Sample MongoDB document shapes used by the admin panel.

users:
{
  name: str,
  fullName: str,
  email: str,
  password: bcrypt_hash,
  role: "user" | "admin",
  status: "active" | "inactive" | "banned",
  provider: "email" | "google",
  verified: bool,
  plan: str,
  diamonds: int,
  created_at: datetime,
  joined_at: datetime,
  last_login: datetime
}

admin_contents:
{
  title: str,
  category: str,
  body: str,
  status: "draft" | "published" | "archived",
  metadata: dict,
  created_at: datetime,
  updated_at: datetime
}

admin_categories:
{
  name: str,
  description: str,
  status: "active" | "inactive",
  created_at: datetime,
  updated_at: datetime
}

transactions:
{
  user_email: str,
  user_name: str,
  order_id: str,
  payment_id: str,
  plan_name: str,
  amount: float,
  currency: str,
  status: "Paid" | "Failed" | "Refunded",
  timestamp: datetime
}

subscription_plans:
{
  name: "Basic" | "Gold" | "Premium" | str,
  price: float,
  currency: str,
  features: list[str],
  status: "active" | "inactive",
  created_at: datetime,
  updated_at: datetime
}
"""
