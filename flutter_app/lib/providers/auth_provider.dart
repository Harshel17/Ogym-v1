import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';

enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final StorageService _storageService = StorageService();

  AuthStatus _status = AuthStatus.initial;
  User? _user;
  String? _error;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _user != null;
  bool get isLoading => _status == AuthStatus.loading;

  AuthProvider() {
    _init();
  }

  Future<void> _init() async {
    try {
      await _storageService.init();
      await checkAuthStatus();
    } catch (e) {
      // If initialization fails, go to login screen
      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
    }
  }

  Future<void> checkAuthStatus() async {
    _status = AuthStatus.loading;
    notifyListeners();

    try {
      // Check stored token
      final token = await _storageService.getToken();
      
      if (token != null && token.isNotEmpty) {
        // Token exists - verify with server using /api/auth/me
        try {
          final serverUser = await _authService.getCurrentUser();
          if (serverUser != null) {
            _user = serverUser;
            _status = AuthStatus.authenticated;
          } else {
            // Token invalid, clear storage
            await _clearAuthData();
            _status = AuthStatus.unauthenticated;
          }
        } catch (e) {
          // Network error or invalid token - clear and go to login
          await _clearAuthData();
          _status = AuthStatus.unauthenticated;
        }
      } else {
        _user = null;
        _status = AuthStatus.unauthenticated;
      }
    } catch (e) {
      _user = null;
      _status = AuthStatus.unauthenticated;
    }

    notifyListeners();
  }

  Future<void> _clearAuthData() async {
    try {
      await _storageService.removeToken();
      await _storageService.removeUser();
    } catch (e) {
      // Ignore storage errors during cleanup
    }
    _user = null;
  }

  Future<bool> login(String email, String password) async {
    _status = AuthStatus.loading;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.login(email, password);
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String? gymCode,
    String? gymName,
    bool isPersonalMode = false,
  }) async {
    _status = AuthStatus.loading;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.register(
        name: name,
        email: email,
        password: password,
        role: role,
        gymCode: gymCode,
        gymName: gymName,
        isPersonalMode: isPersonalMode,
      );
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _status = AuthStatus.loading;
    notifyListeners();

    try {
      await _authService.logout();
    } catch (e) {
      // Ignore logout errors - just clear local state
    }
    
    await _clearAuthData();
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<bool> deleteAccount(String confirmWord) async {
    _status = AuthStatus.loading;
    _error = null;
    notifyListeners();

    try {
      await _authService.deleteAccount(confirmWord);
      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    if (_status == AuthStatus.error) {
      _status = _user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
    }
    notifyListeners();
  }
}
