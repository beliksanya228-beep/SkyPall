from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== MODELS =====
class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    role: str = "user"  # user, trader, admin
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TraderRegister(BaseModel):
    name: str
    nickname: str
    usdt_address: str
    phone: str

class Trader(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    nickname: str
    usdt_address: str
    phone: str
    usdt_balance: float = 0.0
    is_blocked: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CardCreate(BaseModel):
    card_number: str
    bank_name: str
    holder_name: str
    limit: float
    currency: str = "UAH"

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trader_id: str
    card_number: str
    bank_name: str
    holder_name: str
    limit: float
    current_usage: float = 0.0
    status: str = "active"  # active, paused
    currency: str = "UAH"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CardUpdate(BaseModel):
    limit: Optional[float] = None
    status: Optional[str] = None

class TransactionRequest(BaseModel):
    amount: float
    currency: str = "UAH"

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    trader_id: str
    card_id: str
    amount: float
    currency: str = "UAH"
    status: str = "pending"  # pending, user_confirmed, trader_confirmed, completed, cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_confirmed_at: Optional[str] = None
    completed_at: Optional[str] = None
    expires_at: str = Field(default_factory=lambda: (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat())

class AdminAddBalance(BaseModel):
    amount: float

class AdminSettings(BaseModel):
    commission_rate: float  # percentage

# ===== AUTH HELPERS =====
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

async def require_trader(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] not in ['trader', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trader access required")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

# ===== AUTH ROUTES =====
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    user = User(
        email=data.email,
        password_hash=hash_password(data.password)
    )
    await db.users.insert_one(user.model_dump())
    
    token = create_token(user.id, user.email, user.role)
    return {"token": token, "user": {"id": user.id, "email": user.email, "role": user.role}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'], user['role'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "role": user['role']}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    trader = None
    if user['role'] in ['trader', 'admin']:
        trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    
    return {
        "id": user['id'],
        "email": user['email'],
        "role": user['role'],
        "trader": trader
    }

# ===== TRADER ROUTES =====
@api_router.post("/trader/register")
async def become_trader(data: TraderRegister, user: dict = Depends(get_current_user)):
    if user['role'] == 'trader':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a trader")
    
    existing = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trader profile already exists")
    
    trader = Trader(
        user_id=user['id'],
        name=data.name,
        nickname=data.nickname,
        usdt_address=data.usdt_address,
        phone=data.phone
    )
    await db.traders.insert_one(trader.model_dump())
    
    # Update user role
    await db.users.update_one({"id": user['id']}, {"$set": {"role": "trader"}})
    
    return trader

@api_router.get("/trader/profile")
async def get_trader_profile(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    return trader

@api_router.post("/trader/cards")
async def add_card(data: CardCreate, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    card = Card(
        trader_id=trader['id'],
        card_number=data.card_number,
        bank_name=data.bank_name,
        holder_name=data.holder_name,
        limit=data.limit,
        currency=data.currency
    )
    await db.cards.insert_one(card.model_dump())
    return card

@api_router.get("/trader/cards")
async def get_trader_cards(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        return []
    
    cards = await db.cards.find({"trader_id": trader['id']}, {"_id": 0}).to_list(1000)
    return cards

@api_router.put("/trader/cards/{card_id}")
async def update_card(card_id: str, data: CardUpdate, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    card = await db.cards.find_one({"id": card_id, "trader_id": trader['id']}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.cards.update_one({"id": card_id}, {"$set": update_data})
    
    updated_card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    return updated_card

@api_router.delete("/trader/cards/{card_id}")
async def delete_card(card_id: str, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    result = await db.cards.delete_one({"id": card_id, "trader_id": trader['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    return {"message": "Card deleted successfully"}

@api_router.get("/trader/transactions")
async def get_trader_transactions(user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        return []
    
    transactions = await db.transactions.find({"trader_id": trader['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with card info
    for txn in transactions:
        card = await db.cards.find_one({"id": txn['card_id']}, {"_id": 0})
        txn['card'] = card
    
    return transactions

@api_router.post("/trader/confirm-payment/{transaction_id}")
async def trader_confirm_payment(transaction_id: str, user: dict = Depends(require_trader)):
    trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader profile not found")
    
    txn = await db.transactions.find_one({"id": transaction_id, "trader_id": trader['id']}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    
    if txn['status'] != 'user_confirmed':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User must confirm payment first")
    
    # Calculate commission (1%)
    settings = await db.settings.find_one({}, {"_id": 0})
    commission_rate = settings['commission_rate'] if settings else 1.0
    commission = txn['amount'] * (commission_rate / 100)
    usdt_to_send = txn['amount'] - commission
    
    # Emulate USDT transaction
    if trader['usdt_balance'] < usdt_to_send:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient USDT balance")
    
    # Update trader balance
    new_balance = trader['usdt_balance'] - usdt_to_send
    await db.traders.update_one({"id": trader['id']}, {"$set": {"usdt_balance": new_balance}})
    
    # Update transaction
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment confirmed and USDT sent", "usdt_sent": usdt_to_send, "commission": commission}

# ===== USER ROUTES =====
@api_router.post("/user/request-card")
async def request_card(data: TransactionRequest, user: dict = Depends(get_current_user)):
    # Validate amount
    if data.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    
    # Find available card
    cards = await db.cards.find({
        "status": "active",
        "currency": data.currency
    }, {"_id": 0}).to_list(1000)
    
    if not cards:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No available cards")
    
    # Find card with sufficient limit
    available_card = None
    for card in cards:
        if (card['limit'] - card['current_usage']) >= data.amount:
            available_card = card
            break
    
    if not available_card:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No card with sufficient limit")
    
    # Create transaction
    txn = Transaction(
        user_id=user['id'],
        trader_id=available_card['trader_id'],
        card_id=available_card['id'],
        amount=data.amount,
        currency=data.currency
    )
    await db.transactions.insert_one(txn.model_dump())
    
    # Update card usage
    await db.cards.update_one(
        {"id": available_card['id']},
        {"$set": {"current_usage": available_card['current_usage'] + data.amount}}
    )
    
    # Get trader info
    trader = await db.traders.find_one({"id": available_card['trader_id']}, {"_id": 0})
    
    return {
        "transaction_id": txn.id,
        "card": {
            "bank_name": available_card['bank_name'],
            "card_number": available_card['card_number'],
            "holder_name": available_card['holder_name'],
            "amount": data.amount,
            "currency": data.currency
        },
        "expires_at": txn.expires_at
    }

@api_router.post("/user/confirm-payment/{transaction_id}")
async def user_confirm_payment(transaction_id: str, user: dict = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": transaction_id, "user_id": user['id']}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    
    if txn['status'] != 'pending':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction already processed")
    
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "user_confirmed",
            "user_confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment confirmation sent to trader"}

@api_router.get("/user/transactions")
async def get_user_transactions(user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

# ===== ADMIN ROUTES =====
@api_router.get("/admin/traders")
async def get_all_traders(user: dict = Depends(require_admin)):
    traders = await db.traders.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with user email
    for trader in traders:
        user_doc = await db.users.find_one({"id": trader['user_id']}, {"_id": 0})
        trader['email'] = user_doc['email'] if user_doc else None
    
    return traders

@api_router.get("/admin/users")
async def get_all_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/admin/traders/{trader_id}/add-balance")
async def admin_add_balance(trader_id: str, data: AdminAddBalance, user: dict = Depends(require_admin)):
    trader = await db.traders.find_one({"id": trader_id}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader not found")
    
    new_balance = trader['usdt_balance'] + data.amount
    await db.traders.update_one({"id": trader_id}, {"$set": {"usdt_balance": new_balance}})
    
    return {"message": "Balance added", "new_balance": new_balance}

@api_router.put("/admin/traders/{trader_id}/block")
async def admin_block_trader(trader_id: str, user: dict = Depends(require_admin)):
    trader = await db.traders.find_one({"id": trader_id}, {"_id": 0})
    if not trader:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trader not found")
    
    new_status = not trader['is_blocked']
    await db.traders.update_one({"id": trader_id}, {"$set": {"is_blocked": new_status}})
    
    return {"message": "Trader status updated", "is_blocked": new_status}

@api_router.get("/admin/transactions")
async def get_all_transactions(user: dict = Depends(require_admin)):
    transactions = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

@api_router.get("/admin/settings")
async def get_settings(user: dict = Depends(require_admin)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"commission_rate": 1.0}
        await db.settings.insert_one(settings)
    return settings

@api_router.put("/admin/settings")
async def update_settings(data: AdminSettings, user: dict = Depends(require_admin)):
    await db.settings.update_one({}, {"$set": data.model_dump()}, upsert=True)
    return {"message": "Settings updated"}

# ===== STATS ROUTE =====
@api_router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    if user['role'] == 'trader':
        trader = await db.traders.find_one({"user_id": user['id']}, {"_id": 0})
        if trader:
            completed = await db.transactions.count_documents({"trader_id": trader['id'], "status": "completed"})
            pending = await db.transactions.count_documents({"trader_id": trader['id'], "status": "user_confirmed"})
            cards_count = await db.cards.count_documents({"trader_id": trader['id']})
            return {
                "balance": trader['usdt_balance'],
                "completed_transactions": completed,
                "pending_transactions": pending,
                "cards_count": cards_count
            }
    elif user['role'] == 'admin':
        total_traders = await db.traders.count_documents({})
        total_users = await db.users.count_documents({"role": "user"})
        total_transactions = await db.transactions.count_documents({})
        completed_transactions = await db.transactions.count_documents({"status": "completed"})
        return {
            "total_traders": total_traders,
            "total_users": total_users,
            "total_transactions": total_transactions,
            "completed_transactions": completed_transactions
        }
    else:
        completed = await db.transactions.count_documents({"user_id": user['id'], "status": "completed"})
        pending = await db.transactions.count_documents({"user_id": user['id'], "status": {"$in": ["pending", "user_confirmed"]}})
        return {
            "completed_transactions": completed,
            "pending_transactions": pending
        }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()