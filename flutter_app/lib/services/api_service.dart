import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final StorageService _storage = StorageService();

  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Mobile-App': 'true',
    };

    if (withAuth) {
      final token = await _storage.getToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
        print('[API] Token found: ${token.substring(0, 20)}...'); // Debug
      } else {
        print('[API] No token available'); // Debug
      }
    }

    return headers;
  }

  Future<dynamic> get(String endpoint, {bool withAuth = true}) async {
    try {
      final headers = await _getHeaders(withAuth: withAuth);
      final response = await http.get(
        Uri.parse(endpoint),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      return _handleResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Connection failed. Check your internet connection.');
    }
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body, bool withAuth = true, Map<String, String>? headers}) async {
    try {
      final baseHeaders = await _getHeaders(withAuth: withAuth);
      if (headers != null) {
        baseHeaders.addAll(headers);
      }
      final response = await http.post(
        Uri.parse(endpoint),
        headers: baseHeaders,
        body: body != null ? jsonEncode(body) : null,
      ).timeout(const Duration(seconds: 30));
      return _handleResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Connection failed. Check your internet connection.');
    }
  }

  Future<dynamic> put(String endpoint, {Map<String, dynamic>? body, bool withAuth = true}) async {
    try {
      final headers = await _getHeaders(withAuth: withAuth);
      final response = await http.put(
        Uri.parse(endpoint),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _handleResponse(response);
    } catch (e) {
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body, bool withAuth = true}) async {
    try {
      final headers = await _getHeaders(withAuth: withAuth);
      final response = await http.patch(
        Uri.parse(endpoint),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _handleResponse(response);
    } catch (e) {
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  Future<dynamic> delete(String endpoint, {Map<String, dynamic>? body, bool withAuth = true}) async {
    try {
      final headers = await _getHeaders(withAuth: withAuth);
      final request = http.Request('DELETE', Uri.parse(endpoint));
      request.headers.addAll(headers);
      if (body != null) {
        request.body = jsonEncode(body);
      }
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } catch (e) {
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  dynamic _handleResponse(http.Response response) {
    print('[API] Response status: ${response.statusCode}'); // Debug
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      try {
        return jsonDecode(response.body);
      } catch (e) {
        return response.body;
      }
    } else {
      String message = 'Server error';
      try {
        final data = jsonDecode(response.body);
        message = data['message'] ?? data['error'] ?? 'Server error';
      } catch (e) {
        message = response.body.isNotEmpty ? response.body : 'Server error';
      }
      
      print('[API] Error: $message'); // Debug
      
      // Provide better error messages
      if (response.statusCode == 401) {
        throw ApiException(message.isNotEmpty && message != 'Server error' 
            ? message 
            : 'Session expired. Please login again.', statusCode: 401);
      } else if (response.statusCode == 403) {
        throw ApiException(message.isNotEmpty && message != 'Server error' 
            ? message 
            : 'Access denied.', statusCode: 403);
      } else if (response.statusCode == 404) {
        throw ApiException(message.isNotEmpty && message != 'Server error' 
            ? message 
            : 'Resource not found.', statusCode: 404);
      } else {
        throw ApiException(message, statusCode: response.statusCode);
      }
    }
  }
}
