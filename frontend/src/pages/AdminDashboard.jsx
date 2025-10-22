import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../App';
import { toast } from 'sonner';
import { LogOut, Users, UserCheck, DollarSign, Settings, Ban, CheckCircle } from 'lucide-react';

export default function AdminDashboard({ user, onLogout }) {
  const [traders, setTraders] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ commission_rate: 1.0 });
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createdUserData, setCreatedUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Create User Form
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      const [tradersRes, usersRes, txRes, statsRes, settingsRes] = await Promise.all([
        api.get('/admin/traders'),
        api.get('/admin/users'),
        api.get('/admin/transactions'),
        api.get('/stats'),
        api.get('/admin/settings')
      ]);
      setTraders(tradersRes.data);
      setUsers(usersRes.data);
      setTransactions(txRes.data);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const handleAddBalance = async (e) => {
    e.preventDefault();
    if (!selectedTrader) return;

    setLoading(true);
    try {
      await api.post(`/admin/traders/${selectedTrader.id}/add-balance`, {
        amount: parseFloat(balanceAmount)
      });
      toast.success('Баланс пополнен!');
      setShowAddBalance(false);
      setBalanceAmount('');
      setSelectedTrader(null);
      loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка пополнения');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockTrader = async (traderId, isBlocked) => {
    try {
      await api.put(`/admin/traders/${traderId}/block`);
      toast.success(isBlocked ? 'Трейдер разблокирован' : 'Трейдер заблокирован');
      loadAdminData();
    } catch (error) {
      toast.error('Ошибка блокировки');
    }
  };

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      await api.put(`/admin/users/${userId}/block`);
      toast.success(isBlocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
      loadAdminData();
    } catch (error) {
      toast.error('Ошибка блокировки пользователя');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/admin/users/create', userForm);
      setCreatedUserData(response.data.user);
      toast.success('Аккаунт создан!');
      setUserForm({ email: '', password: '', role: 'user' });
      loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания аккаунта');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCreatedUser = () => {
    setCreatedUserData(null);
    setShowCreateUser(false);
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put('/admin/settings', settings);
      toast.success('Настройки обновлены!');
      loadAdminData();
    } catch (error) {
      toast.error('Ошибка обновления настроек');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Ожидание' },
      user_confirmed: { color: 'bg-blue-100 text-blue-800', text: 'Ожидает трейдера' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Завершено' },
      cancelled: { color: 'bg-red-100 text-red-800', text: 'Отменено' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.text}</span>;
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800" style={{ fontFamily: 'Manrope' }} data-testid="admin-dashboard-title">
              Админ панель
            </h1>
            <p className="text-gray-600 mt-1">{user.email}</p>
          </div>
          <Button variant="outline" onClick={onLogout} className="gap-2" data-testid="admin-logout-button">
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
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  Трейдеров
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600" data-testid="total-traders">{stats.total_traders}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Пользователей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600" data-testid="total-users">{stats.total_users}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Всего транзакций
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600" data-testid="total-transactions">{stats.total_transactions}</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                  Завершенных
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-teal-600" data-testid="completed-transactions">{stats.completed_transactions}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="traders" className="space-y-6">
          <TabsList className="bg-white shadow-md">
            <TabsTrigger value="traders" data-testid="traders-tab">Трейдеры</TabsTrigger>
            <TabsTrigger value="users" data-testid="users-tab">Пользователи</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="transactions-tab">Транзакции</TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">Настройки</TabsTrigger>
          </TabsList>

          {/* Traders Tab */}
          <TabsContent value="traders">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                  Управление трейдерами
                </CardTitle>
              </CardHeader>
              <CardContent>
                {traders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500" data-testid="no-traders-message">Трейдеров пока нет</div>
                ) : (
                  <div className="space-y-4">
                    {traders.map((trader) => (
                      <div key={trader.id} className="p-4 bg-gray-50 rounded-lg border" data-testid="trader-item">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-lg" data-testid="trader-name">{trader.name} (@{trader.nickname})</div>
                            <div className="text-sm text-gray-600">Email: {trader.email}</div>
                            <div className="text-sm text-gray-600">Телефон: {trader.phone}</div>
                            <div className="text-sm text-gray-600">USDT адрес: {trader.usdt_address}</div>
                            <div className="text-sm font-semibold mt-1">
                              Баланс USDT: <span className="text-green-600" data-testid="trader-balance">{trader.usdt_balance.toFixed(2)}</span>
                            </div>
                            {trader.is_blocked && (
                              <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                Заблокирован
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTrader(trader);
                                setShowAddBalance(true);
                              }}
                              data-testid="add-balance-button"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Пополнить
                            </Button>
                            <Button
                              size="sm"
                              variant={trader.is_blocked ? 'default' : 'destructive'}
                              onClick={() => handleBlockTrader(trader.id, trader.is_blocked)}
                              data-testid="block-trader-button"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-purple-600" />
                  Все пользователи
                </CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Пользователей пока нет</div>
                ) : (
                  <div className="space-y-3">
                    {users.map((u) => (
                      <div key={u.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg" data-testid="user-item">
                        <div className="flex-1">
                          <div className="font-semibold" data-testid="user-email">{u.email}</div>
                          <div className="text-sm text-gray-600">Роль: {u.role}</div>
                          <div className="text-xs text-gray-500">{new Date(u.created_at).toLocaleString('ru-RU')}</div>
                          {u.is_blocked && (
                            <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                              Заблокирован
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-red-100 text-red-800' :
                            u.role === 'trader' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role}
                          </span>
                          {u.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant={u.is_blocked ? 'default' : 'destructive'}
                              onClick={() => handleBlockUser(u.id, u.is_blocked)}
                              data-testid="block-user-button"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
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
                      <div key={txn.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg" data-testid="transaction-item">
                        <div>
                          <div className="font-semibold text-lg" data-testid="transaction-amount">{txn.amount} {txn.currency}</div>
                          <div className="text-sm text-gray-600">User ID: {txn.user_id.substring(0, 8)}...</div>
                          <div className="text-sm text-gray-600">Trader ID: {txn.trader_id.substring(0, 8)}...</div>
                          <div className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleString('ru-RU')}</div>
                        </div>
                        <div data-testid="transaction-status">{getStatusBadge(txn.status)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-6 w-6 text-gray-600" />
                  Настройки системы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="commission">Комиссия системы (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.01"
                      value={settings.commission_rate}
                      onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) })}
                      required
                      data-testid="commission-input"
                    />
                    <p className="text-sm text-gray-500">
                      Комиссия добавляется к сумме пополнения
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Курс USDT/UAH (1 USDT = X UAH)</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={settings.usd_to_uah_rate}
                      onChange={(e) => setSettings({ ...settings, usd_to_uah_rate: parseFloat(e.target.value) })}
                      required
                      data-testid="rate-input"
                    />
                    <p className="text-sm text-gray-500">
                      Текущий курс: 1 USDT = {settings.usd_to_uah_rate} UAH
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wallet">TRC-20 кошелек для пополнений</Label>
                    <Input
                      id="wallet"
                      type="text"
                      value={settings.deposit_wallet_address || ''}
                      onChange={(e) => setSettings({ ...settings, deposit_wallet_address: e.target.value })}
                      required
                      data-testid="wallet-input"
                      placeholder="TB4K5h9QwFGSYR2LLJS9ejmt9EjHWurvi1"
                    />
                    <p className="text-sm text-gray-500">
                      Адрес для пополнения баланса трейдерами
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Пример расчета:</h4>
                    <p className="text-sm text-gray-700">
                      Пользователь хочет получить 100 USDT<br/>
                      Сумма без комиссии: {(100 * settings.usd_to_uah_rate).toFixed(2)} UAH<br/>
                      Комиссия: {(100 * settings.usd_to_uah_rate * settings.commission_rate / 100).toFixed(2)} UAH<br/>
                      <strong>Итого к оплате: {(100 * settings.usd_to_uah_rate * (1 + settings.commission_rate / 100)).toFixed(2)} UAH</strong>
                    </p>
                  </div>
                  <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-600" data-testid="update-settings-button">
                    {loading ? 'Обновление...' : 'Обновить настройки'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Balance Dialog */}
        <Dialog open={showAddBalance} onOpenChange={setShowAddBalance}>
          <DialogContent data-testid="add-balance-dialog">
            <DialogHeader>
              <DialogTitle>Пополнить баланс трейдера</DialogTitle>
              <DialogDescription>
                {selectedTrader && `${selectedTrader.name} (@${selectedTrader.nickname})`}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBalance} className="space-y-4">
              <div className="space-y-2">
                <Label>Сумма USDT</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  required
                  data-testid="balance-amount-input"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} data-testid="submit-balance-button">
                  {loading ? 'Пополнение...' : 'Пополнить'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
