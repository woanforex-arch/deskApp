<?php

namespace Database\Seeders;

use App\Enums\AccountType;
use App\Models\Account;
use Illuminate\Database\Seeder;

class AccountSeeder extends Seeder
{
    public function run(): void
    {
        $chart = [
            [
                'code' => '1000',
                'name' => 'Assets',
                'type' => AccountType::Asset,
                'description' => 'Resources owned by the business.',
                'children' => [
                    ['code' => '1100', 'name' => 'Cash and Cash Equivalents', 'description' => 'Operating bank accounts and petty cash.'],
                    ['code' => '1110', 'name' => 'Operating Bank Account', 'description' => 'Primary day-to-day bank account.'],
                    ['code' => '1120', 'name' => 'Petty Cash', 'description' => 'Small cash float held on premises.'],
                    ['code' => '1200', 'name' => 'Accounts Receivable', 'description' => 'Amounts owed by customers.'],
                    ['code' => '1300', 'name' => 'Inventory', 'description' => 'Goods held for resale.'],
                    ['code' => '1500', 'name' => 'Fixed Assets', 'description' => 'Computers, furniture, and office equipment.'],
                    ['code' => '1510', 'name' => 'Accumulated Depreciation', 'description' => 'Contra-asset for accumulated depreciation.'],
                    ['code' => '1600', 'name' => 'Input VAT Recoverable', 'description' => 'VAT paid on purchases and recoverable from the tax authority.'],
                ],
            ],
            [
                'code' => '2000',
                'name' => 'Liabilities',
                'type' => AccountType::Liability,
                'description' => 'Obligations owed to third parties.',
                'children' => [
                    ['code' => '2100', 'name' => 'Accounts Payable', 'description' => 'Amounts owed to vendors.'],
                    ['code' => '2200', 'name' => 'Sales Tax Payable', 'description' => 'Tax collected on behalf of authorities.'],
                    ['code' => '2300', 'name' => 'Loans Payable', 'description' => 'Long-term debt obligations.'],
                    ['code' => '2400', 'name' => 'Deferred Revenue', 'description' => 'Customer prepayments not yet recognised as revenue.'],
                ],
            ],
            [
                'code' => '3000',
                'name' => 'Equity',
                'type' => AccountType::Equity,
                'description' => "Owners' residual interest in the business.",
                'children' => [
                    ['code' => '3100', 'name' => "Owner's Equity", 'description' => 'Capital contributed by the owner.'],
                    ['code' => '3200', 'name' => 'Retained Earnings', 'description' => 'Accumulated profits retained in the business.'],
                ],
            ],
            [
                'code' => '4000',
                'name' => 'Revenue',
                'type' => AccountType::Revenue,
                'description' => 'Income earned from operations.',
                'children' => [
                    ['code' => '4100', 'name' => 'Consulting Revenue', 'description' => 'Advisory and consulting services.'],
                    ['code' => '4200', 'name' => 'Product Sales', 'description' => 'Revenue from product sales.'],
                    ['code' => '4300', 'name' => 'Service Revenue', 'description' => 'Recurring service and support revenue.'],
                    ['code' => '5900', 'name' => 'Foreign Exchange Gain', 'description' => 'Realised gains on foreign currency transactions.'],
                ],
            ],
            [
                'code' => '5000',
                'name' => 'Expenses',
                'type' => AccountType::Expense,
                'description' => 'Costs incurred to operate the business.',
                'children' => [
                    ['code' => '5100', 'name' => 'Cost of Goods Sold', 'description' => 'Direct cost of delivered goods and services.'],
                    ['code' => '5200', 'name' => 'Salaries and Wages', 'description' => 'Payroll and contractor costs.'],
                    ['code' => '5300', 'name' => 'Rent', 'description' => 'Office and studio rent.'],
                    ['code' => '5400', 'name' => 'Utilities', 'description' => 'Power, water, and internet.'],
                    ['code' => '5500', 'name' => 'Software Subscriptions', 'description' => 'SaaS and software licences.'],
                    ['code' => '5600', 'name' => 'Marketing', 'description' => 'Advertising and demand generation.'],
                    ['code' => '5700', 'name' => 'Depreciation Expense', 'description' => 'Periodic write-down of fixed assets.'],
                    ['code' => '5800', 'name' => 'Foreign Exchange Loss', 'description' => 'Realised losses on foreign currency transactions.'],
                    ['code' => '6100', 'name' => 'Inventory Adjustments', 'description' => 'Stock count and shrinkage adjustments.'],
                ],
            ],
        ];

        $categories = [
            '1100' => 'cash',
            '1110' => 'cash',
            '1120' => 'cash',
            '1200' => 'receivable',
            '1300' => 'inventory',
            '1500' => 'fixed_asset',
            '1510' => 'fixed_asset',
            '1600' => 'tax',
            '2100' => 'payable',
            '2200' => 'tax',
            '2300' => 'debt',
            '2400' => 'current_liability',
            '3100' => 'equity',
            '3200' => 'equity',
            '4100' => 'revenue',
            '4200' => 'revenue',
            '4300' => 'revenue',
            '5900' => 'other_income',
            '5100' => 'cost_of_sales',
            '5200' => 'operating_expense',
            '5300' => 'operating_expense',
            '5400' => 'operating_expense',
            '5500' => 'operating_expense',
            '5600' => 'operating_expense',
            '5700' => 'operating_expense',
            '5800' => 'other_expense',
            '6100' => 'cost_of_sales',
        ];

        $controlAccounts = ['1200', '1300', '1500', '2100', '2200'];

        foreach ($chart as $group) {
            $parent = Account::updateOrCreate(
                ['code' => $group['code']],
                [
                    'name' => $group['name'],
                    'type' => $group['type'],
                    'description' => $group['description'],
                    'parent_id' => null,
                    'is_active' => true,
                ],
            );

            foreach ($group['children'] as $child) {
                Account::updateOrCreate(
                    ['code' => $child['code']],
                    [
                        'name' => $child['name'],
                        'type' => $group['type'],
                        'description' => $child['description'],
                        'category' => $categories[$child['code']] ?? null,
                        'is_control' => in_array($child['code'], $controlAccounts, true),
                        'parent_id' => $parent->id,
                        'is_active' => true,
                    ],
                );
            }
        }
    }
}
