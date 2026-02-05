class ApiConstants {
  static const String baseUrl = 'https://app.ogym.fitness';
  static const String apiUrl = '$baseUrl/api';
  
  // Auth endpoints
  static const String login = '$apiUrl/auth/login';
  static const String logout = '$apiUrl/auth/logout';
  static const String register = '$apiUrl/auth/register';
  static const String currentUser = '$apiUrl/auth/user';
  
  // Member endpoints
  static const String memberDashboard = '$apiUrl/member/dashboard';
  static const String memberWorkouts = '$apiUrl/member/workouts';
  static const String memberNutrition = '$apiUrl/member/nutrition';
  static const String memberMeasurements = '$apiUrl/member/measurements';
  static const String todayWorkout = '$apiUrl/member/today-workout';
  static const String workoutSummary = '$apiUrl/member/workout-summary';
  
  // Workout endpoints
  static const String workoutComplete = '$apiUrl/workouts/complete';
  static const String workoutReorder = '$apiUrl/workouts/reorder';
  static const String availableDays = '$apiUrl/workouts/available-days';
  
  // Owner endpoints
  static const String ownerDashboard = '$apiUrl/owner/dashboard';
  static const String ownerMembers = '$apiUrl/owner/members';
  static const String ownerPayments = '$apiUrl/owner/payments';
  static const String ownerAnnouncements = '$apiUrl/owner/announcements';
  static const String ownerWalkins = '$apiUrl/owner/walkins';
  static const String ownerInsights = '$apiUrl/owner/ai-insights';
  
  // Trainer endpoints
  static const String trainerDashboard = '$apiUrl/trainer/dashboard';
  static const String trainerMembers = '$apiUrl/trainer/members';
  static const String trainerStarMembers = '$apiUrl/trainer/star-members';
  
  // Nutrition endpoints
  static const String nutritionLog = '$apiUrl/nutrition/log';
  static const String nutritionToday = '$apiUrl/nutrition/today';
  static const String calorieGoals = '$apiUrl/nutrition/goals';
  
  // AI endpoints
  static const String dikaChat = '$apiUrl/dika/chat';
  static const String findMyFood = '$apiUrl/find-my-food';
  
  // Profile endpoints
  static const String profile = '$apiUrl/profile';
  static const String deleteAccount = '$apiUrl/users/me';
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
