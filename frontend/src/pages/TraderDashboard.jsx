import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { api } from '../App';
import { toast } from 'sonner';
import { LogOut, CreditCard, Wallet, Plus, Edit, Trash2, CheckCircle, Clock, DollarSign } from 'lucide-react';

export default function TraderDashboard({ user, onLogout, onUpdate }) {
  const [isTrader, setIsTrader] = useState(false);
  const [traderProfile, setTraderProfile] = useState(null);
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [depositWallet, setDepositWallet] = useState('');
  const [showBecomeTrader, setShowBecomeTrader] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showDepositInfo, setShowDepositInfo] = useState(false);
  const [loading, setLoading] = useState(false);

  // Become Trader Form
  const [traderForm, setTraderForm] = useState({
    name: '',
    nickname: '',
    usdt_address: '',
    phone: ''
  });

  // Add Card Form
  const [cardForm, setCardForm] = useState({
    card_number: '',
    bank_name: '',
    holder_name: '',
    limit: '',
    currency: 'UAH'
  });

  useEffect(() => {
    checkTraderStatus();
  }, [user]);

  useEffect(() => {
    if (isTrader) {
      loadTraderData();
      const interval = setInterval(loadTraderData, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isTrader]);

  const checkTraderStatus = async () => {
    if (user.role === 'trader' || user.role === 'admin') {
      setIsTrader(true);
    }
  };

  const loadTraderData = async () => {
    try {
      const [profileRes, cardsRes, txRes, statsRes, settingsRes] = await Promise.all([
        api.get('/trader/profile'),
        api.get('/trader/cards'),
        api.get('/trader/transactions'),
        api.get('/stats'),
        api.get('/settings/public')
      ]);
      setTraderProfile(profileRes.data);
      setCards(cardsRes.data);
      setTransactions(txRes.data);
      setStats(statsRes.data);
      setDepositWallet(settingsRes.data.deposit_wallet_address);
    } catch (error) {
      console.error('Error loading trader data:', error);
    }
  };

  const handleBecomeTrader = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/trader/register', traderForm);
      toast.success('Вы стали трейдером!');
      setShowBecomeTrader(false);
      setIsTrader(true);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/trader/cards', {
        ...cardForm,
        limit: parseFloat(cardForm.limit)
      });
      toast.success('Карта добавлена!');
      setShowAddCard(false);
      setCardForm({ card_number: '', bank_name: '', holder_name: '', limit: '', currency: 'UAH' });
      loadTraderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления карты');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCardStatus = async (cardId, currentStatus) => {
    try {
      await api.put(`/trader/cards/${cardId}`, {
        status: currentStatus === 'active' ? 'paused' : 'active'
      });
      toast.success('Статус карты обновлен');
      loadTraderData();
    } catch (error) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Удалить карту?')) return;

    try {
      await api.delete(`/trader/cards/${cardId}`);
      toast.success('Карта удалена');
      loadTraderData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleConfirmPayment = async (transactionId) => {
    try {
      await api.post(`/trader/confirm-payment/${transactionId}`);
      toast.success('USDT отправлен клиенту!');
      loadTraderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка подтверждения');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Ожидание клиента' },
      user_confirmed: { color: 'bg-blue-100 text-blue-800', text: 'Ожидает подтверждения' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Завершено' },
      cancelled: { color: 'bg-red-100 text-red-800', text: 'Отменено' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.text}</span>;
  };

  if (!isTrader) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl" style={{ fontFamily: 'Manrope' }}>Стать трейдером</CardTitle>
            <CardDescription>Заполните данные для начала работы</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBecomeTrader} className="space-y-4">
              <div className="space-y-2">
                <Label>Имя</Label>
                <Input value={traderForm.name} onChange={(e) => setTraderForm({...traderForm, name: e.target.value})} required data-testid="trader-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Никнейм</Label>
                <Input value={traderForm.nickname} onChange={(e) => setTraderForm({...traderForm, nickname: e.target.value})} required data-testid="trader-nickname-input" />
              </div>
              <div className="space-y-2">
                <Label>USDT адрес</Label>
                <Input value={traderForm.usdt_address} onChange={(e) => setTraderForm({...traderForm, usdt_address: e.target.value})} required data-testid="trader-usdt-input" />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input value={traderForm.phone} onChange={(e) => setTraderForm({...traderForm, phone: e.target.value})} required data-testid="trader-phone-input" />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-600" disabled={loading} data-testid="become-trader-button">
                {loading ? 'Загрузка...' : 'Стать трейдером'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800" style={{ fontFamily: 'Manrope' }} data-testid="trader-dashboard-title">
              Кабинет трейдера
            </h1>
            <p className="text-gray-600 mt-1">{traderProfile?.nickname} ({user.email})</p>
          </div>
          <Button variant="outline" onClick={onLogout} className="gap-2" data-testid="trader-logout-button">
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  USDT баланс
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600" data-testid="usdt-balance">{stats.balance?.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Завершено</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600" data-testid="completed-count">{stats.completed_transactions}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ожидает</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600" data-testid="pending-count">{stats.pending_transactions}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Карт</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600" data-testid="cards-count">{stats.cards_count}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cards */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-blue-600" />
                Мои карты
              </CardTitle>
              <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600" data-testid="add-card-trigger">
                    <Plus className="h-4 w-4" />
                    Добавить карту
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="add-card-dialog">
                  <DialogHeader>
                    <DialogTitle>Добавить карту</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddCard} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Номер карты</Label>
                      <Input value={cardForm.card_number} onChange={(e) => setCardForm({...cardForm, card_number: e.target.value})} required data-testid="card-number-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Банк</Label>
                      <Input value={cardForm.bank_name} onChange={(e) => setCardForm({...cardForm, bank_name: e.target.value})} required data-testid="bank-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Владелец</Label>
                      <Input value={cardForm.holder_name} onChange={(e) => setCardForm({...cardForm, holder_name: e.target.value})} required data-testid="holder-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Лимит (UAH)</Label>
                      <Input type="number" step="0.01" value={cardForm.limit} onChange={(e) => setCardForm({...cardForm, limit: e.target.value})} required data-testid="card-limit-input" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading} data-testid="submit-card-button">
                        {loading ? 'Добавление...' : 'Добавить'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {cards.length === 0 ? (
              <div className="text-center py-8 text-gray-500" data-testid="no-cards-message">Карт пока нет</div>
            ) : (
              <div className="grid gap-4">
                {cards.map((card) => (
                  <div key={card.id} className="p-4 bg-gray-50 rounded-lg border" data-testid="card-item">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-lg" data-testid="card-item-number">{card.card_number}</div>
                        <div className="text-sm text-gray-600">{card.bank_name} - {card.holder_name}</div>
                        <div className="text-sm mt-1">
                          Лимит: <span className="font-semibold" data-testid="card-limit">{card.limit} {card.currency}</span> | 
                          Использовано: <span className="font-semibold">{card.current_usage}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={card.status === 'active' ? 'default' : 'outline'}
                          onClick={() => handleToggleCardStatus(card.id, card.status)}
                          data-testid="toggle-card-status"
                        >
                          {card.status === 'active' ? 'Активна' : 'На паузе'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteCard(card.id)} data-testid="delete-card-button">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Transactions */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-yellow-600" />
              Ожидают подтверждения
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.filter(t => t.status === 'user_confirmed').length === 0 ? (
              <div className="text-center py-8 text-gray-500" data-testid="no-pending-message">Нет ожидающих заявок</div>
            ) : (
              <div className="space-y-3">
                {transactions.filter(t => t.status === 'user_confirmed').map((txn) => (
                  <div key={txn.id} className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200" data-testid="pending-transaction-item">
                    <div>
                      <div className="font-bold text-xl" data-testid="pending-amount">{txn.amount} {txn.currency}</div>
                      <div className="text-sm text-gray-600">Карта: {txn.card?.card_number}</div>
                      <div className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                    <Button onClick={() => handleConfirmPayment(txn.id)} className="bg-green-600 hover:bg-green-700" data-testid="confirm-trader-payment">
                      Подтвердить
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Transactions */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Все транзакции</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Транзакций пока нет</div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div key={txn.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-lg">{txn.amount} {txn.currency}</div>
                      <div className="text-sm text-gray-600">Карта: {txn.card?.card_number}</div>
                      <div className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                    {getStatusBadge(txn.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}