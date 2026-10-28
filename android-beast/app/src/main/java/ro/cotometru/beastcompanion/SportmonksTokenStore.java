package ro.cotometru.beastcompanion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Separate encrypted store. Original BEAST SSE key is left untouched. */
final class SportmonksTokenStore {
    private static final String ALIAS = "BEAST-SPORTMONKS-v1";
    private static final String STORE = "sportmonks_secret";
    private SportmonksTokenStore() {}

    private static SecretKey getKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            g.init(new KeyGenParameterSpec.Builder(ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            g.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    static void save(Context ctx, String token) throws Exception {
        if (token == null || token.trim().isEmpty()) throw new IllegalArgumentException("Token lipsă");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        byte[] payload = cipher.doFinal(token.trim().getBytes(StandardCharsets.UTF_8));
        boolean ok = ctx.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit()
            .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString("cipher", Base64.encodeToString(payload, Base64.NO_WRAP)).commit();
        if (!ok) throw new IllegalStateException("Nu s-a salvat tokenul");
    }

    static String read(Context ctx) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(STORE, Context.MODE_PRIVATE);
            String iv = p.getString("iv", ""), ciphertext = p.getString("cipher", "");
            if (iv.isEmpty() || ciphertext.isEmpty()) return "";
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception ignored) { return ""; }
    }
}
