import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { api } from '../App';
import { toast } from 'sonner';
import { LogOut, CreditCard, History, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function UserDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [cardDetails, setCardDetails] = useState(null);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, txRes] = await Promise.all([
        api.get('/stats'),
        api.get('/user/transactions')
      ]);
      setStats(statsRes.data);
      setTransactions(txRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleRequestCard = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/user/request-card', {
        amount: parseFloat(amount),
        currency: 'UAH'
      });
      setCardDetails(response.data.card);
      setCurrentTransaction(response.data.transaction_id);
      toast.success('Реквизиты получены!');
      setAmount('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка получения карты');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!currentTransaction) return;

    try {
      await api.post(`/user/confirm-payment/${currentTransaction}`);
      toast.success('Подтверждение отправлено трейдеру');
      setCardDetails(null);
      setCurrentTransaction(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка подтверждения');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Ожидание' },
      user_confirmed: { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Ожидает трейдера' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Завершено' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Отменено' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800" style={{ fontFamily: 'Manrope' }} data-testid="user-dashboard-title">
              Личный кабинет
            </h1>
            <p className="text-gray-600 mt-1">{user.email}</p>
          </div>
          <Button variant="outline" onClick={onLogout} className="gap-2" data-testid="logout-button">
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Завершенные транзакции
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600" data-testid="completed-transactions-count">{stats.completed_transactions}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Текущие транзакции
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600" data-testid="pending-transactions-count">{stats.pending_transactions}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Request Card */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-blue-600" />
              Пополнить через карту
            </CardTitle>
            <CardDescription>Запросите реквизиты для перевода</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestCard} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма в USDT</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  data-testid="request-amount-input"
                />
                <p className="text-xs text-gray-500">
                  Укажите сколько USDT вы хотите получить
                </p>
              </div>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700" data-testid="request-card-button">
                {loading ? 'Запрос...' : 'Получить реквизиты'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card Details Dialog */}
        {cardDetails && (
          <Card className="mb-8 shadow-xl border-2 border-blue-500" data-testid="card-details-card">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardTitle>Реквизиты для перевода</CardTitle>
              <CardDescription className="text-blue-100">Переведите указанную сумму на эту карту</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Банк</Label>
                  <div className="text-xl font-semibold" data-testid="card-bank">{cardDetails.bank_name}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Номер карты</Label>
                  <div className="text-2xl font-bold tracking-wider" data-testid="card-number">{cardDetails.card_number}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Получатель</Label>
                  <div className="text-lg font-semibold" data-testid="card-holder">{cardDetails.holder_name}</div>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Вы получите USDT:</span>
                    <span className="font-semibold" data-testid="usdt-amount">{cardDetails.usdt_amount} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Комиссия ({cardDetails.commission_rate}%):</span>
                    <span className="text-red-600" data-testid="commission-amount">{cardDetails.commission_amount} {cardDetails.currency}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <Label className="text-sm text-gray-600">Сумма к оплате:</Label>
                    <div className="text-3xl font-bold text-blue-600" data-testid="card-amount">{cardDetails.amount} {cardDetails.currency}</div>
                  </div>
                </div>
              </div>
              <Button onClick={handleConfirmPayment} className="w-full bg-green-600 hover:bg-green-700" data-testid="confirm-payment-button">
                Я оплатил
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-6 w-6 text-purple-600" />
              История транзакций
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500" data-testid="no-transactions-message">
                Транзакций пока нет
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div key={txn.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" data-testid="transaction-item">
                    <div>
                      <div className="font-semibold text-lg" data-testid="transaction-amount">{txn.amount} {txn.currency}</div>
                      <div className="text-sm text-gray-500" data-testid="transaction-date">{new Date(txn.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                    <div data-testid="transaction-status">{getStatusBadge(txn.status)}</div>
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