package com.pianoworkout.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.provider.Settings;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQ_CODE = 1001;
    private static final String TAG = "JazzTraneR";
    private static String sPendingShareJson = null;

    public static class ShareBridge {
        @android.webkit.JavascriptInterface
        public String getPendingShare() {
            String share = sPendingShareJson;
            sPendingShareJson = null; // consommer une seule fois
            return share != null ? share : "";
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Empêche la mise en veille de l'écran pendant l'utilisation
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Configuration edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Verrouillage immersif immédiat
        activerModePleinEcranImmersif();

        // Écouteur sur les Insets (appelé à chaque ouverture/fermeture du clavier virtuel, rotation, etc.)
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            v.post(this::activerModePleinEcranImmersif);
            return insets;
        });

        // Écouteur système complémentaire pour les versions et surcouches Android (Samsung One UI)
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0 || (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0) {
                decorView.post(this::activerModePleinEcranImmersif);
            }
        });

        // Enregistrer le bridge JavaScript pour la réception de partages iReal Pro
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new ShareBridge(), "NativeShareBridge");
            bridge.getWebView().addJavascriptInterface(new SystemBridge(), "NativeSystemBridge");
        }

        // Traiter l'intent au démarrage à froid
        traiterIntentPartage(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new ShareBridge(), "NativeShareBridge");
            bridge.getWebView().addJavascriptInterface(new SystemBridge(), "NativeSystemBridge");
        }
        activerModePleinEcranImmersif();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            activerModePleinEcranImmersif();
        }
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        activerModePleinEcranImmersif();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        traiterIntentPartage(intent);
    }

    private void traiterIntentPartage(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_VIEW.equals(action)) return;

        String content = null;
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        // 1. Extraction depuis EXTRA_STREAM (fichier HTML iReal Pro) ou Data ou ClipData
        Uri targetUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (targetUri == null) {
            targetUri = intent.getData();
        }
        if (targetUri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
            targetUri = intent.getClipData().getItemAt(0).getUri();
        }

        if (targetUri != null) {
            try (InputStream is = getContentResolver().openInputStream(targetUri)) {
                if (is != null) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = is.read(buffer)) != -1) {
                        baos.write(buffer, 0, len);
                    }
                    content = baos.toString("UTF-8");
                }
            } catch (Exception e) {
                Log.e(TAG, "Erreur lecture flux partagé : " + e.getMessage());
            }
        }

        // 2. Extraction depuis EXTRA_TEXT si pas de flux ou flux vide
        if (content == null || content.trim().isEmpty()) {
            content = intent.getStringExtra(Intent.EXTRA_TEXT);
        }

        if (content != null && (content.contains("irealb://") || content.contains("<html") || content.contains("<a href="))) {
            try {
                JSONObject json = new JSONObject();
                json.put("content", content);
                json.put("subject", subject != null ? subject : "");
                sPendingShareJson = json.toString();

                // Si le WebView est déjà prêt (app ouverte en arrière-plan)
                runOnUiThread(() -> {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().evaluateJavascript(
                            "window.receptionnerPartageIReal && window.receptionnerPartageIReal(" + json.toString() + ");",
                            null
                        );
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Erreur JSON intent partagé : " + e.getMessage());
            }
        }
    }

    // ---------------------------------------------------------------
    // Seam systeme : "Enregistrer sous..." (SAF), micro, reglages app
    // ---------------------------------------------------------------
    private static final int REQ_CREATE_DOCUMENT = 2001;
    private String pendingSaveCacheName = null;

    public class SystemBridge {
        @android.webkit.JavascriptInterface
        public void saveToDocument(String cacheFileName, String displayName, String mime) {
            runOnUiThread(() -> {
                pendingSaveCacheName = cacheFileName;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime != null && !mime.isEmpty() ? mime : "application/octet-stream");
                intent.putExtra(Intent.EXTRA_TITLE, displayName);
                startActivityForResult(intent, REQ_CREATE_DOCUMENT);
            });
        }

        @android.webkit.JavascriptInterface
        public boolean checkMicrophone() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        }

        @android.webkit.JavascriptInterface
        public void requestMicrophone() {
            runOnUiThread(() -> ActivityCompat.requestPermissions(MainActivity.this, new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS
            }, PERMISSION_REQ_CODE));
        }

        @android.webkit.JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getPackageName(), null));
                startActivity(intent);
            });
        }
    }

    private void notifierWeb(String fn, String arg) {
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().evaluateJavascript("window." + fn + " && window." + fn + "(" + arg + ");", null);
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_CREATE_DOCUMENT) return;
        String cacheName = pendingSaveCacheName;
        pendingSaveCacheName = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || cacheName == null) {
            notifierWeb("onNativeSaveResult", "false");
            return;
        }
        try (InputStream in = new FileInputStream(new File(getCacheDir(), cacheName));
             OutputStream out = getContentResolver().openOutputStream(data.getData())) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = in.read(buffer)) != -1) out.write(buffer, 0, len);
            out.flush();
            notifierWeb("onNativeSaveResult", "true");
        } catch (Exception e) {
            Log.e(TAG, "Erreur ecriture sauvegarde : " + e.getMessage());
            notifierWeb("onNativeSaveResult", "false");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != PERMISSION_REQ_CODE) return;
        boolean granted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
        String result = granted ? "granted"
            : (!ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.RECORD_AUDIO)
                ? "permanently_denied" : "denied");
        notifierWeb("onNativeMicResult", "'" + result + "'");
    }

    @SuppressWarnings("deprecation")
    private void activerModePleinEcranImmersif() {
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decorView);
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }

        // Support de secours pour les flags bas niveau (garantit que Samsung One UI ne réaffiche rien)
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
