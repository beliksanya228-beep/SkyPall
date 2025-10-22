import requests
import sys
import json
from datetime import datetime

class PaymentSystemTester:
    def __init__(self, base_url="https://usdtpay-bot.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.test_data = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token_type=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token_type and token_type in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[token_type]}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_auth_flow(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        # Test login with existing accounts
        test_accounts = [
            ("admin@test.com", "admin123", "admin"),
            ("trader@test.com", "trader123", "trader"),
            ("user@test.com", "user123", "user")
        ]
        
        for email, password, role in test_accounts:
            success, response = self.run_test(
                f"Login as {role}",
                "POST",
                "auth/login",
                200,
                data={"email": email, "password": password}
            )
            if success and 'token' in response:
                self.tokens[role] = response['token']
                print(f"   Token stored for {role}")
            else:
                print(f"   ❌ Failed to get token for {role}")
        
        # Test /auth/me for each role
        for role in ["admin", "trader", "user"]:
            if role in self.tokens:
                success, response = self.run_test(
                    f"Get profile for {role}",
                    "GET",
                    "auth/me",
                    200,
                    token_type=role
                )
                if success:
                    self.test_data[f"{role}_profile"] = response

    def test_user_flow(self):
        """Test user functionality"""
        print("\n=== TESTING USER FUNCTIONALITY ===")
        
        if 'user' not in self.tokens:
            print("❌ No user token available, skipping user tests")
            return
        
        # Test request card
        success, response = self.run_test(
            "User request card",
            "POST",
            "user/request-card",
            200,
            data={"amount": 1000, "currency": "UAH"},
            token_type="user"
        )
        if success:
            self.test_data['transaction_id'] = response.get('transaction_id')
            self.test_data['card_details'] = response.get('card')
            print(f"   Transaction ID: {self.test_data['transaction_id']}")
        
        # Test user transactions
        self.run_test(
            "Get user transactions",
            "GET",
            "user/transactions",
            200,
            token_type="user"
        )
        
        # Test user stats
        self.run_test(
            "Get user stats",
            "GET",
            "stats",
            200,
            token_type="user"
        )
        
        # Test confirm payment if we have transaction
        if 'transaction_id' in self.test_data:
            success, response = self.run_test(
                "User confirm payment",
                "POST",
                f"user/confirm-payment/{self.test_data['transaction_id']}",
                200,
                token_type="user"
            )

    def test_trader_flow(self):
        """Test trader functionality"""
        print("\n=== TESTING TRADER FUNCTIONALITY ===")
        
        if 'trader' not in self.tokens:
            print("❌ No trader token available, skipping trader tests")
            return
        
        # Test trader profile
        self.run_test(
            "Get trader profile",
            "GET",
            "trader/profile",
            200,
            token_type="trader"
        )
        
        # Test trader cards
        success, response = self.run_test(
            "Get trader cards",
            "GET",
            "trader/cards",
            200,
            token_type="trader"
        )
        if success:
            self.test_data['trader_cards'] = response
        
        # Test trader transactions
        success, response = self.run_test(
            "Get trader transactions",
            "GET",
            "trader/transactions",
            200,
            token_type="trader"
        )
        if success:
            self.test_data['trader_transactions'] = response
            # Find user_confirmed transaction for testing
            for txn in response:
                if txn['status'] == 'user_confirmed':
                    self.test_data['pending_transaction'] = txn['id']
                    break
        
        # Test trader stats
        self.run_test(
            "Get trader stats",
            "GET",
            "stats",
            200,
            token_type="trader"
        )
        
        # Test confirm payment if we have pending transaction
        if 'pending_transaction' in self.test_data:
            success, response = self.run_test(
                "Trader confirm payment",
                "POST",
                f"trader/confirm-payment/{self.test_data['pending_transaction']}",
                200,
                token_type="trader"
            )

    def test_admin_flow(self):
        """Test admin functionality"""
        print("\n=== TESTING ADMIN FUNCTIONALITY ===")
        
        if 'admin' not in self.tokens:
            print("❌ No admin token available, skipping admin tests")
            return
        
        # Test get all traders
        success, response = self.run_test(
            "Get all traders",
            "GET",
            "admin/traders",
            200,
            token_type="admin"
        )
        if success and response:
            self.test_data['all_traders'] = response
            if response:
                self.test_data['first_trader_id'] = response[0]['id']
        
        # Test get all users
        self.run_test(
            "Get all users",
            "GET",
            "admin/users",
            200,
            token_type="admin"
        )
        
        # Test get all transactions
        self.run_test(
            "Get all transactions",
            "GET",
            "admin/transactions",
            200,
            token_type="admin"
        )
        
        # Test admin stats
        self.run_test(
            "Get admin stats",
            "GET",
            "stats",
            200,
            token_type="admin"
        )
        
        # Test settings
        success, response = self.run_test(
            "Get settings",
            "GET",
            "admin/settings",
            200,
            token_type="admin"
        )
        
        # Test update settings
        self.run_test(
            "Update settings",
            "PUT",
            "admin/settings",
            200,
            data={"commission_rate": 1.5},
            token_type="admin"
        )
        
        # Test add balance to trader
        if 'first_trader_id' in self.test_data:
            self.run_test(
                "Add balance to trader",
                "POST",
                f"admin/traders/{self.test_data['first_trader_id']}/add-balance",
                200,
                data={"amount": 100},
                token_type="admin"
            )

    def test_error_cases(self):
        """Test error handling"""
        print("\n=== TESTING ERROR CASES ===")
        
        # Test unauthorized access
        self.run_test(
            "Unauthorized access to admin",
            "GET",
            "admin/traders",
            401
        )
        
        # Test invalid login
        self.run_test(
            "Invalid login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrong"}
        )
        
        # Test request card with invalid amount
        if 'user' in self.tokens:
            self.run_test(
                "Request card with invalid amount",
                "POST",
                "user/request-card",
                400,
                data={"amount": -100, "currency": "UAH"},
                token_type="user"
            )

def main():
    print("🚀 Starting Payment System API Tests")
    print("=" * 50)
    
    tester = PaymentSystemTester()
    
    # Run all test suites
    tester.test_auth_flow()
    tester.test_user_flow()
    tester.test_trader_flow()
    tester.test_admin_flow()
    tester.test_error_cases()
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {len(tester.failed_tests)}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            print(f"  - {failure['test']}: {failure.get('error', f'Expected {failure.get(\"expected\")}, got {failure.get(\"actual\")}')}")
    
    # Save test data for debugging
    with open('/app/test_reports/backend_test_data.json', 'w') as f:
        json.dump({
            'test_results': {
                'total': tester.tests_run,
                'passed': tester.tests_passed,
                'failed': len(tester.failed_tests),
                'success_rate': tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0
            },
            'failed_tests': tester.failed_tests,
            'test_data': tester.test_data
        }, f, indent=2)
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())