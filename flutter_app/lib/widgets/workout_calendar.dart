import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/workout.dart';

class WorkoutCalendar extends StatefulWidget {
  final WorkoutSummary? summary;

  const WorkoutCalendar({super.key, this.summary});

  @override
  State<WorkoutCalendar> createState() => _WorkoutCalendarState();
}

class _WorkoutCalendarState extends State<WorkoutCalendar> {
  late DateTime _currentMonth;
  DateTime? _selectedDate;

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime.now();
  }

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          // Month navigation
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: _previousMonth,
                icon: const Icon(Icons.chevron_left),
              ),
              Text(
                _formatMonth(_currentMonth),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              IconButton(
                onPressed: _nextMonth,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const SizedBox(height: 8),
          
          // Day headers
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) {
              return SizedBox(
                width: 36,
                child: Text(
                  day,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          
          // Calendar grid
          _buildCalendarGrid(isDark),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid(bool isDark) {
    final firstDayOfMonth = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDayOfMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    
    // Get the weekday of the first day (1 = Monday, 7 = Sunday)
    int startWeekday = firstDayOfMonth.weekday;
    
    // Calculate total cells needed
    int totalDays = lastDayOfMonth.day;
    int leadingEmptyCells = startWeekday - 1;
    int totalCells = leadingEmptyCells + totalDays;
    int rows = (totalCells / 7).ceil();

    return Column(
      children: List.generate(rows, (rowIndex) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: List.generate(7, (colIndex) {
            int cellIndex = rowIndex * 7 + colIndex;
            int dayNumber = cellIndex - leadingEmptyCells + 1;

            if (dayNumber < 1 || dayNumber > totalDays) {
              return const SizedBox(width: 36, height: 36);
            }

            final date = DateTime(_currentMonth.year, _currentMonth.month, dayNumber);
            final isToday = _isToday(date);
            final isSelected = _selectedDate != null && _isSameDay(date, _selectedDate!);
            final status = _getStatusForDate(date);

            return GestureDetector(
              onTap: () => setState(() => _selectedDate = date),
              child: _DayCell(
                day: dayNumber,
                isToday: isToday,
                isSelected: isSelected,
                status: status,
              ),
            );
          }),
        );
      }),
    );
  }

  String _getStatusForDate(DateTime date) {
    // Get monthly data from summary if available
    final monthlyData = widget.summary?.monthlyData;
    if (monthlyData == null) return 'none';

    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final dayData = monthlyData[dateStr];
    
    if (dayData is Map) {
      return dayData['status'] as String? ?? 'none';
    }
    
    return 'none';
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _formatMonth(DateTime date) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[date.month - 1]} ${date.year}';
  }
}

class _DayCell extends StatelessWidget {
  final int day;
  final bool isToday;
  final bool isSelected;
  final String status;

  const _DayCell({
    required this.day,
    required this.isToday,
    required this.isSelected,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    Color? bgColor;
    Color textColor = isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
    
    if (isSelected) {
      bgColor = AppColors.primary;
      textColor = Colors.white;
    } else if (isToday) {
      bgColor = AppColors.primary.withOpacity(0.2);
    }

    // Status indicator color
    Color? indicatorColor;
    switch (status) {
      case 'completed':
        indicatorColor = AppColors.success;
        break;
      case 'missed':
        indicatorColor = AppColors.error;
        break;
      case 'rest':
        indicatorColor = AppColors.secondary;
        break;
    }

    return Container(
      width: 36,
      height: 36,
      margin: const EdgeInsets.symmetric(vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Text(
            day.toString(),
            style: TextStyle(
              fontSize: 14,
              fontWeight: isToday || isSelected ? FontWeight.w600 : FontWeight.normal,
              color: textColor,
            ),
          ),
          if (indicatorColor != null && !isSelected)
            Positioned(
              bottom: 4,
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: indicatorColor,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
