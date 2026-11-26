import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  X,
} from 'lucide-react';
import { verifySealedIntegrity } from '../core/vaultCrypto';
import {
  authenticateBiometricUnlock,
  checkBiometricAvailability,
  enrollBiometricUnlock,
  hasEnrolledBiometricUnlock,
  type BiometricCapability,
} from '../platform/biometric';
import type { ArchiveDocument, HapticPattern } from '../types/archive';

interface VaultLockModalProps {
  isZh?: boolean;
  vaultUnlocked: boolean;
  hasPasscodeSet: boolean;
  vaultDocuments: ArchiveDocument[];
  sealedDocuments: ArchiveDocument[];
  onSetAndUnlock: (passcode: string) => Promise<void>;
  onUnlock: (passcode: string) => Promise<boolean>;
  onLockVault: () => Promise<void>;
  onHaptic?: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const VaultLockModal: React.FC<VaultLockModalProps> = ({
  isZh = true,
  vaultUnlocked,
  hasPasscodeSet,
  vaultDocuments,
  sealedDocuments,
  onSetAndUnlock,
  onUnlock,
  onLockVault,
  onHaptic,
  onClose,
}) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  const [bioCap, setBioCap] = useState<BiometricCapability>({
    available: false,
    kind: 'none',
    label: isZh ? '检测生物识别硬件...' : 'Checking biometric hardware...',
  });
  const [bioEnrolled, setBioEnrolled] = useState(() => hasEnrolledBiometricUnlock());
  const [auditResults, setAuditResults] = useState<
    Array<{ id: string; title: string; ok: boolean; hash: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    checkBiometricAvailability().then((cap) => {
      if (!cancelled) setBioCap(cap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAction = async () => {
    setError(null);
    setBioMsg(null);
    if (!passcode.trim()) {
      setError(isZh ? '请输入保险箱主密码' : 'Please enter vault passcode');
      onHaptic?.('error');
      return;
    }
    if (!hasPasscodeSet && passcode !== confirmPasscode) {
      setError(isZh ? '两次输入的密码不一致' : 'Passcodes do not match');
      onHaptic?.('error');
      return;
    }
    setBusy(true);
    try {
      if (!hasPasscodeSet) {
        await onSetAndUnlock(passcode);
        onHaptic?.('success');
        onClose();
      } else if (!vaultUnlocked) {
        const ok = await onUnlock(passcode);
        if (!ok) {
          setError(isZh ? '保险箱密码校验失败，请重试' : 'Incorrect vault passcode. Please try again.');
          onHaptic?.('error');
        } else {
          onHaptic?.('success');
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onHaptic?.('error');
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setError(null);
    setBioMsg(null);
    setBusy(true);
    try {
      const res = await authenticateBiometricUnlock();
      if (!res.ok || !res.passcode) {
        setError(res.message);
        onHaptic?.('error');
        return;
      }
      const ok = await onUnlock(res.passcode);
      if (!ok) {
        setError(
          isZh
            ? '生物识别凭据与当前主密码不匹配，请用密码解锁后重新绑定'
            : 'Biometric credential does not match current passcode. Unlock with passcode and re-enroll.',
        );
        onHaptic?.('error');
      } else {
        onHaptic?.('success');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEnrollBiometric = async () => {
    setError(null);
    setBioMsg(null);
    if (!passcode.trim()) {
      setError(
        isZh
          ? '请先在上方输入当前保险箱主密码以绑定本机生物识别'
          : 'Enter your current vault passcode above to bind biometrics',
      );
      onHaptic?.('warning');
      return;
    }
    setBusy(true);
    try {
      const res = await enrollBiometricUnlock(passcode);
      if (!res.ok) {
        setError(res.message);
        onHaptic?.('error');
      } else {
        setBioEnrolled(true);
        setBioMsg(res.message);
        onHaptic?.('success');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunIntegrityAudit = async () => {
    setBusy(true);
    const out: Array<{ id: string; title: string; ok: boolean; hash: string }> = [];
    for (const doc of sealedDocuments) {
      if (!doc.sealedHash) continue;
      const res = await verifySealedIntegrity(doc.markdownText, doc.sealedHash);
      out.push({
        id: doc.id,
        title: doc.title,
        ok: res.ok,
        hash: res.actualHash.slice(0, 14),
      });
    }
    setAuditResults(out);
    setBusy(false);
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" data-tour="vault-lock-modal" style={{ width: 'min(580px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--accent)" />
            <strong>{isZh ? '私密档案保险箱 · AES-256-GCM 端到端加密' : 'Private Vault · AES-256-GCM Encryption'}</strong>
          </div>
          <button className="arc-btn arc-icon-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--bg-subtle)',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              <strong>{isZh ? '加密算法：' : 'Cipher: '}</strong>
              {isZh
                ? 'PBKDF2-HMAC-SHA256 (120,000 轮密钥派生) + AES-256-GCM 认证加密'
                : 'PBKDF2-HMAC-SHA256 (120,000 iterations) + AES-256-GCM AEAD'}
            </div>
            <div>
              <strong>{isZh ? '当前状态：' : 'Status: '}</strong>
              {!hasPasscodeSet
                ? isZh
                  ? '首次启用，请设置保险箱独立主密码'
                  : 'First setup: set a dedicated vault passcode'
                : vaultUnlocked
                  ? isZh
                    ? `已解锁（共保护 ${vaultDocuments.length} 份私密档案）`
                    : `Unlocked (${vaultDocuments.length} protected documents)`
                  : isZh
                    ? `已加密上锁（${vaultDocuments.length} 份档案正文已置换为 AES-GCM 密文信封）`
                    : `Locked (${vaultDocuments.length} documents sealed in AES-GCM envelopes)`}
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(220,38,38,0.12)',
                color: '#dc2626',
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}

          {(!hasPasscodeSet || !vaultUnlocked) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12.5 }}>
                <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {hasPasscodeSet ? (isZh ? '输入保险箱密码解锁' : 'Enter Vault Passcode') : isZh ? '设置保险箱独立密码' : 'Set Vault Passcode'}
                </div>
                <input
                  className="arc-input"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAction();
                  }}
                  placeholder={isZh ? '输入高强度密码...' : 'Enter strong passcode...'}
                  autoFocus
                />
              </label>

              {!hasPasscodeSet && (
                <label style={{ fontSize: 12.5 }}>
                  <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '确认密码' : 'Confirm Passcode'}</div>
                  <input
                    className="arc-input"
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAction();
                    }}
                    placeholder={isZh ? '再次输入密码...' : 'Re-enter passcode...'}
                  />
                </label>
              )}

              {bioMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(22,163,74,0.12)',
                    color: '#15803d',
                    fontSize: 12.5,
                  }}
                >
                  {bioMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <button
                  className="arc-btn arc-btn-primary"
                  style={{ flex: 1, justifyContent: 'center', height: 38 }}
                  disabled={busy}
                  onClick={handleAction}
                >
                  {hasPasscodeSet ? <Unlock size={14} /> : <KeyRound size={14} />}
                  <span>
                    {busy
                      ? isZh
                        ? '正在派生密钥...'
                        : 'Deriving Key...'
                      : hasPasscodeSet
                        ? isZh
                          ? 'AES-256-GCM 解锁保险箱'
                          : 'Unlock Vault (AES-256-GCM)'
                        : isZh
                          ? '设置密码并加密保护'
                          : 'Set Passcode & Encrypt'}
                  </span>
                </button>
                <button
                  className="arc-btn"
                  style={{ height: 38 }}
                  disabled={busy}
                  title={bioCap.label}
                  onClick={handleBiometricUnlock}
                >
                  <Fingerprint size={15} />
                  <span>{bioEnrolled ? (isZh ? '生物识别解锁' : 'Biometric Unlock') : isZh ? '指纹 / 面容解锁' : 'Touch / Face ID'}</span>
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {isZh ? '生物识别状态：' : 'Biometrics: '}{bioCap.label}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="arc-input"
                  type="password"
                  style={{ flex: '1 1 180px' }}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={isZh ? '输入主密码以绑定本机生物识别...' : 'Enter passcode to bind biometrics...'}
                />
                <button
                  className="arc-btn"
                  disabled={busy}
                  onClick={handleEnrollBiometric}
                >
                  <Fingerprint size={14} />
                  <span>{bioEnrolled ? (isZh ? '重新绑定生物识别' : 'Re-enroll Biometrics') : isZh ? '绑定指纹/面容解锁' : 'Enroll Biometrics'}</span>
                </button>
              </div>
              {bioMsg && (
                <div style={{ fontSize: 12, color: '#15803d' }}>{bioMsg}</div>
              )}
              <button
                className="arc-btn arc-btn-primary"
                style={{ width: '100%', justifyContent: 'center', height: 38 }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onLockVault();
                  onHaptic?.('medium');
                  setBusy(false);
                }}
              >
                <Lock size={14} />
                <span>{isZh ? '立即加密上锁并擦除内存明文' : 'Lock Vault & Wipe Plaintext'}</span>
              </button>
            </div>
          )}

          {/* Sealed Documents SHA-256 Integrity Check */}
          <div
            style={{
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>
                {isZh
                  ? `已封存档案 SHA-256 防篡改完整性校验（${sealedDocuments.length} 份）`
                  : `Sealed Docs SHA-256 Integrity Audit (${sealedDocuments.length})`}
              </strong>
              <button
                className="arc-btn"
                style={{ height: 28, fontSize: 12 }}
                disabled={busy || sealedDocuments.length === 0}
                onClick={handleRunIntegrityAudit}
              >
                {isZh ? '立即校验哈希' : 'Verify Hashes'}
              </button>
            </div>

            {auditResults.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.ok ? <CheckCircle2 size={14} color="#16a34a" /> : <AlertCircle size={14} color="#dc2626" />}
                  <strong>{r.title}</strong>
                </span>
                <span className="arc-badge">
                  {r.ok ? (isZh ? '校验通过' : 'Verified') : isZh ? '哈希不匹配' : 'Mismatch'} · {r.hash}...
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
