import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  Future<SharedPreferences> get prefs async {
    if (_prefs == null) {
      await init();
    }
    return _prefs!;
  }

  // Token management
  Future<void> saveToken(String token) async {
    final p = await prefs;
    await p.setString(AppConstants.tokenKey, token);
  }

  Future<String?> getToken() async {
    final p = await prefs;
    return p.getString(AppConstants.tokenKey);
  }

  Future<void> removeToken() async {
    final p = await prefs;
    await p.remove(AppConstants.tokenKey);
  }

  // User management
  Future<void> saveUser(User user) async {
    final p = await prefs;
    await p.setString(AppConstants.userKey, jsonEncode(user.toJson()));
  }

  Future<User?> getUser() async {
    final p = await prefs;
    final userJson = p.getString(AppConstants.userKey);
    if (userJson != null) {
      try {
        return User.fromJson(jsonDecode(userJson));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  Future<void> removeUser() async {
    final p = await prefs;
    await p.remove(AppConstants.userKey);
  }

  // Theme management
  Future<void> saveThemeMode(String mode) async {
    final p = await prefs;
    await p.setString(AppConstants.themeKey, mode);
  }

  Future<String?> getThemeMode() async {
    final p = await prefs;
    return p.getString(AppConstants.themeKey);
  }

  // Clear all data
  Future<void> clearAll() async {
    final p = await prefs;
    await p.clear();
  }

  // Generic methods
  Future<void> setString(String key, String value) async {
    final p = await prefs;
    await p.setString(key, value);
  }

  Future<String?> getString(String key) async {
    final p = await prefs;
    return p.getString(key);
  }

  Future<void> setBool(String key, bool value) async {
    final p = await prefs;
    await p.setBool(key, value);
  }

  Future<bool?> getBool(String key) async {
    final p = await prefs;
    return p.getBool(key);
  }

  Future<void> remove(String key) async {
    final p = await prefs;
    await p.remove(key);
  }
}
