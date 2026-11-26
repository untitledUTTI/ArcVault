import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/archive_models.dart';

class WorkspaceStoragePaths {
  const WorkspaceStoragePaths({
    required this.vaultDir,
    required this.backupDir,
  });

  final String vaultDir;
  final String backupDir;
}

class WorkspaceStorage {
  WorkspaceStorage._();

  static const String settingsKey = 'arcvault_settings_v1';
  static const String onboardingKey = 'arcvault_onboarding_completed';
  static const String workspaceBackupFileName = 'arcvault_workspace_latest.json';

  static Future<AppSettingsModel> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(settingsKey);
    if (raw == null || raw.isEmpty) return const AppSettingsModel();
    try {
      final decoded = jsonDecodeSafe(raw);
      return AppSettingsModel.fromJson(decoded);
    } catch (_) {
      return const AppSettingsModel();
    }
  }

  static Future<void> saveSettings(AppSettingsModel settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(settingsKey, jsonEncodeSafe(settings.toJson()));
  }

  static Future<bool> hasCompletedOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(onboardingKey) == true;
  }

  static Future<void> setOnboardingCompleted(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(onboardingKey, value);
  }

  static Future<WorkspaceStoragePaths> resolveEffectivePaths(AppSettingsModel settings) async {
    final appDocDir = await getApplicationDocumentsDirectory();
    final defaultVault = '${appDocDir.path}${Platform.pathSeparator}ArcVault_Vault';
    final defaultBackup = '${appDocDir.path}${Platform.pathSeparator}ArcVault_Backups';

    final vaultDir = settings.customVaultDir.trim().isNotEmpty
        ? settings.customVaultDir.trim()
        : defaultVault;
    final backupDir = settings.customBackupDir.trim().isNotEmpty
        ? settings.customBackupDir.trim()
        : defaultBackup;

    return WorkspaceStoragePaths(vaultDir: vaultDir, backupDir: backupDir);
  }

  static Future<void> ensureDirectories(WorkspaceStoragePaths paths) async {
    await Directory(paths.vaultDir).create(recursive: true);
    await Directory(paths.backupDir).create(recursive: true);
  }

  static Future<void> saveWorkspaceBackup(
    PersistedWorkspaceState state,
    AppSettingsModel settings,
  ) async {
    final paths = await resolveEffectivePaths(settings);
    await ensureDirectories(paths);
    final raw = state.toRawJson();
    final latestFile = File('${paths.backupDir}${Platform.pathSeparator}$workspaceBackupFileName');
    await latestFile.writeAsString(raw, flush: true);

    final vaultFile = File('${paths.vaultDir}${Platform.pathSeparator}workspace_index.json');
    await vaultFile.writeAsString(raw, flush: true);
  }

  static Future<PersistedWorkspaceState?> loadWorkspaceBackup(
    AppSettingsModel settings,
  ) async {
    final paths = await resolveEffectivePaths(settings);
    final candidates = [
      File('${paths.backupDir}${Platform.pathSeparator}$workspaceBackupFileName'),
      File('${paths.vaultDir}${Platform.pathSeparator}workspace_index.json'),
    ];
    for (final file in candidates) {
      if (await file.exists()) {
        final raw = await file.readAsString();
        final parsed = PersistedWorkspaceState.tryParse(raw);
        if (parsed != null) return parsed;
      }
    }
    return null;
  }
}

Map<String, dynamic>? jsonDecodeSafe(String raw) {
  final decoded = const JsonDecoder().convert(raw);
  return decoded is Map<String, dynamic> ? decoded : null;
}

String jsonEncodeSafe(Map<String, dynamic> map) => const JsonEncoder().convert(map);
