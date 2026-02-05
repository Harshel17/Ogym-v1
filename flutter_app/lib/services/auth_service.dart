import '../config/constants.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'storage_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiService _api = ApiService();
  final StorageService _storage = StorageService();

  Future<User> login(String email, String password) async {
    final response = await _api.post(
      ApiConstants.login,
      body: {'email': email, 'password': password},
      withAuth: false,
    );

    if (response == null) {
      throw Exception('Invalid response from server');
    }

    final token = response['token'] as String?;
    final userData = response['user'] as Map<String, dynamic>?;

    if (token == null || userData == null) {
      throw Exception('Invalid login response');
    }

    await _storage.saveToken(token);
    final user = User.fromJson(userData);
    await _storage.saveUser(user);

    return user;
  }

  Future<void> logout() async {
    try {
      await _api.post(ApiConstants.logout);
    } catch (e) {
      // Ignore logout errors
    } finally {
      await _storage.removeToken();
      await _storage.removeUser();
    }
  }

  Future<User?> getCurrentUser() async {
    try {
      final token = await _storage.getToken();
      if (token == null) return null;

      final response = await _api.get(ApiConstants.currentUser);
      if (response != null) {
        final user = User.fromJson(response as Map<String, dynamic>);
        await _storage.saveUser(user);
        return user;
      }
      return null;
    } catch (e) {
      // If unauthorized, clear local storage
      if (e is ApiException && e.statusCode == 401) {
        await _storage.removeToken();
        await _storage.removeUser();
      }
      return null;
    }
  }

  Future<User?> getStoredUser() async {
    return await _storage.getUser();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.getToken();
    return token != null;
  }

  Future<User> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String? gymCode,
    String? gymName,
    bool isPersonalMode = false,
  }) async {
    final body = {
      'name': name,
      'email': email,
      'password': password,
      'role': role,
    };

    if (gymCode != null) {
      body['gymCode'] = gymCode;
    }
    if (gymName != null) {
      body['gymName'] = gymName;
    }
    if (isPersonalMode) {
      body['isPersonalMode'] = 'true';
    }

    final response = await _api.post(
      ApiConstants.register,
      body: body,
      withAuth: false,
    );

    if (response == null) {
      throw Exception('Invalid response from server');
    }

    final token = response['token'] as String?;
    final userData = response['user'] as Map<String, dynamic>?;

    if (token == null || userData == null) {
      throw Exception('Invalid registration response');
    }

    await _storage.saveToken(token);
    final user = User.fromJson(userData);
    await _storage.saveUser(user);

    return user;
  }

  Future<void> deleteAccount(String confirmWord) async {
    await _api.delete(
      ApiConstants.deleteAccount,
      body: {'confirm': confirmWord},
    );
    await _storage.removeToken();
    await _storage.removeUser();
  }
}
