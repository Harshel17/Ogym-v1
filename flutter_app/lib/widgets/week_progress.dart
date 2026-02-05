import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/workout.dart';

class WeekProgress extends StatelessWidget {
  final WorkoutSummary? summary;

  const WeekProgress({super.key, this.summary});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final weekProgress = summary?.weekProgress ?? [];
    final days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'This Week',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '${summary?.completedThisWeek ?? 0}/${summary?.targetPerWeek ?? 5} completed',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(7, (index) {
              String status = 'upcoming';
              if (index < weekProgress.length) {
                status = weekProgress[index].status;
              }
              
              return _DayIndicator(
                day: days[index],
                status: status,
              );
            }),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _LegendItem(color: AppColors.success, label: 'Completed'),
              const SizedBox(width: 16),
              _LegendItem(color: AppColors.error, label: 'Missed'),
              const SizedBox(width: 16),
              _LegendItem(color: AppColors.secondary, label: 'Rest'),
            ],
          ),
        ],
      ),
    );
  }
}

class _DayIndicator extends StatelessWidget {
  final String day;
  final String status;

  const _DayIndicator({
    required this.day,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    Color bgColor;
    Color textColor;
    IconData? icon;

    switch (status) {
      case 'completed':
        bgColor = AppColors.success;
        textColor = Colors.white;
        icon = Icons.check;
        break;
      case 'missed':
        bgColor = AppColors.error;
        textColor = Colors.white;
        icon = Icons.close;
        break;
      case 'rest':
        bgColor = isDark ? AppColors.surfaceDark : Colors.grey[300]!;
        textColor = isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
        break;
      case 'upcoming':
      default:
        bgColor = isDark ? AppColors.surfaceDark : Colors.grey[200]!;
        textColor = isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
        break;
    }

    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: bgColor,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: icon != null
                ? Icon(icon, size: 18, color: textColor)
                : Text(
                    day,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: textColor,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          day,
          style: TextStyle(
            fontSize: 10,
            color: isDark ? AppColors.textTertiaryDark : AppColors.textTertiaryLight,
          ),
        ),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({
    required this.color,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
        ),
      ],
    );
  }
}
