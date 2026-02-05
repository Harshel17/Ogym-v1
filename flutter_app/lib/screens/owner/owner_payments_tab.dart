import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/owner.dart';
import '../../services/api_service.dart';

class OwnerPaymentsTab extends StatefulWidget {
  const OwnerPaymentsTab({super.key});

  @override
  State<OwnerPaymentsTab> createState() => _OwnerPaymentsTabState();
}

class _OwnerPaymentsTabState extends State<OwnerPaymentsTab> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;
  
  List<Payment> _payments = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchPayments();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchPayments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get(ApiConstants.ownerPayments);
      
      if (response != null) {
        final paymentsList = response is List ? response : (response['payments'] ?? []);
        setState(() {
          _payments = (paymentsList as List<dynamic>)
              .map((e) => Payment.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Payment> _getFilteredPayments(String status) {
    if (status == 'all') return _payments;
    return _payments.where((p) => p.status == status).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payments'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('All'),
                  const SizedBox(width: 4),
                  _Badge(count: _payments.length),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Pending'),
                  const SizedBox(width: 4),
                  _Badge(
                    count: _payments.where((p) => p.status == 'pending').length,
                    color: AppColors.warning,
                  ),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Paid'),
                  const SizedBox(width: 4),
                  _Badge(
                    count: _payments.where((p) => p.status == 'paid').length,
                    color: AppColors.success,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchPayments,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildError()
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _PaymentsList(payments: _getFilteredPayments('all')),
                      _PaymentsList(payments: _getFilteredPayments('pending')),
                      _PaymentsList(payments: _getFilteredPayments('paid')),
                    ],
                  ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.error),
          const SizedBox(height: 16),
          Text(_error!),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _fetchPayments,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final int count;
  final Color color;

  const _Badge({
    required this.count,
    this.color = AppColors.primary,
  });

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        count.toString(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _PaymentsList extends StatelessWidget {
  final List<Payment> payments;

  const _PaymentsList({required this.payments});

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.payment,
              size: 64,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
            const SizedBox(height: 16),
            const Text('No payments found'),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: payments.length,
      itemBuilder: (context, index) {
        return _PaymentCard(payment: payments[index]);
      },
    );
  }
}

class _PaymentCard extends StatelessWidget {
  final Payment payment;

  const _PaymentCard({required this.payment});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color statusColor;
    switch (payment.status) {
      case 'paid':
        statusColor = AppColors.success;
        break;
      case 'pending':
        statusColor = AppColors.warning;
        break;
      case 'overdue':
        statusColor = AppColors.error;
        break;
      default:
        statusColor = AppColors.secondary;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Navigate to payment details
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      payment.status == 'paid' ? Icons.check_circle : Icons.pending,
                      color: statusColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          payment.memberName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          payment.type ?? 'Subscription',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        payment.formattedAmount,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          payment.status.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Divider(
                color: isDark ? AppColors.surfaceDark : Colors.grey[200],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Due: ${_formatDate(payment.dueDate)}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  if (payment.paidAt != null)
                    Text(
                      'Paid: ${_formatDate(payment.paidAt!)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.success,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
