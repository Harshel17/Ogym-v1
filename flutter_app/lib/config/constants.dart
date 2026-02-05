class ApiConstants {
  static const String baseUrl = 'https://app.ogym.fitness';
  static const String apiUrl = '$baseUrl/api';
  
  // Auth endpoints
  static const String login = '$apiUrl/auth/login';
  static const String logout = '$apiUrl/auth/logout';
  static const String register = '$apiUrl/auth/register';
  static const String currentUser = '$apiUrl/auth/me';
  static const String verifyEmail = '$apiUrl/auth/verify-email';
  static const String resendCode = '$apiUrl/auth/resend-code';
  static const String forgotPassword = '$apiUrl/auth/forgot-password';
  static const String resetPassword = '$apiUrl/auth/reset-password';
  
  // Member Workout endpoints
  static const String todayWorkout = '$apiUrl/workouts/today';
  static const String memberWorkouts = '$apiUrl/workouts/cycles/my';
  static const String workoutLogSets = '$apiUrl/workouts/log-sets';
  static const String completeWorkout = '$apiUrl/workouts/complete';
  static const String skipWorkout = '$apiUrl/workouts/skip';
  static const String swapWorkoutDay = '$apiUrl/workouts/swap-day';
  static const String pushWorkoutDay = '$apiUrl/workouts/push-day';
  
  // Nutrition endpoints (CORRECT based on server)
  static const String nutritionLogs = '$apiUrl/nutrition/logs';
  static const String nutritionSummary = '$apiUrl/nutrition/summary';
  static const String nutritionGoal = '$apiUrl/nutrition/goal';
  static const String nutritionAnalytics = '$apiUrl/nutrition/analytics';
  static const String nutritionFoodSearch = '$apiUrl/nutrition/food/search';
  static const String findNearbyRestaurants = '$apiUrl/nutrition/find-nearby-restaurants';
  
  // Measurements
  static const String measurements = '$apiUrl/measurements';
  static const String measurementsLatest = '$apiUrl/measurements/latest';
  
  // Attendance
  static const String attendanceCheckin = '$apiUrl/attendance/checkin';
  static const String attendanceMy = '$apiUrl/attendance/my';
  static const String attendanceGym = '$apiUrl/attendance/gym';
  
  // Member subscription
  static const String memberSubscription = '$apiUrl/member/subscription';
  static const String memberPayments = '$apiUrl/payments/my';
  
  // Owner endpoints
  static const String ownerDashboard = '$apiUrl/owner/dashboard-metrics';
  static const String ownerMembers = '$apiUrl/owner/members';
  static const String ownerMembersDetails = '$apiUrl/owner/members-details';
  static const String ownerTrainers = '$apiUrl/owner/trainers';
  static const String ownerTrainersOverview = '$apiUrl/owner/trainers-overview';
  static const String ownerAssignTrainer = '$apiUrl/owner/assign-trainer';
  static const String ownerQrData = '$apiUrl/owner/qr-data';
  static const String ownerMembershipPlans = '$apiUrl/owner/membership-plans';
  static const String ownerSubscriptions = '$apiUrl/owner/subscriptions';
  static const String ownerTransactions = '$apiUrl/owner/transactions';
  static const String ownerTransactionsSummary = '$apiUrl/owner/transactions/summary';
  static const String ownerSubscriptionAlerts = '$apiUrl/owner/subscription-alerts';
  static const String ownerMembersNeedSubscription = '$apiUrl/owner/members-need-subscription';
  static const String ownerRevenue = '$apiUrl/owner/revenue';
  static const String ownerPayments = '$apiUrl/payments/gym';
  static const String ownerInsights = '$apiUrl/owner/ai-insights';
  
  // Payments
  static const String paymentsGym = '$apiUrl/payments/gym';
  static const String paymentsMark = '$apiUrl/payments/mark';
  
  // Walk-ins
  static const String walkins = '$apiUrl/walkins';
  
  // Announcements
  static const String announcements = '$apiUrl/announcements';
  
  // Trainer endpoints
  static const String trainerDashboard = '$apiUrl/trainer/dashboard';
  static const String trainerMembers = '$apiUrl/trainer/members';
  static const String trainerNewMembers = '$apiUrl/trainer/new-members';
  static const String trainerCycles = '$apiUrl/trainer/cycles';
  static const String trainerActivePhases = '$apiUrl/trainer/active-phases';
  static const String trainerStarMembers = '$apiUrl/trainer/star-members';
  
  // Star Members
  static const String starMembers = '$apiUrl/star-members';
  
  // Dika AI endpoints (CORRECT based on server)
  static const String dikaAsk = '$apiUrl/dika/ask';
  static const String dikaSuggestions = '$apiUrl/dika/suggestions';
  static const String dikaSettings = '$apiUrl/dika/settings';
  
  // Social Feed
  static const String feed = '$apiUrl/feed';
  static const String feedShareWorkout = '$apiUrl/feed/share-workout';
  static const String feedShareAchievement = '$apiUrl/feed/share-achievement';
  
  // Tournaments
  static const String tournaments = '$apiUrl/tournaments';
  
  // Support
  static const String support = '$apiUrl/support';
  static const String supportPublic = '$apiUrl/support/public';
  static const String supportMyTickets = '$apiUrl/support/my-tickets';
  
  // Profile & Account
  static const String deleteAccount = '$apiUrl/users/me';
  static const String blockedUsers = '$apiUrl/users/blocked';
}

class AppConstants {
  static const String appName = 'OGym';
  static const String appVersion = '1.0.0';
  
  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'user_data';
  static const String themeKey = 'theme_mode';
  
  // Roles
  static const String roleOwner = 'owner';
  static const String roleMember = 'member';
  static const String roleTrainer = 'trainer';
}
