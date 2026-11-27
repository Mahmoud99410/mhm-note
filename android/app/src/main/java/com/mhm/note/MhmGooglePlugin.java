package com.mhm.note;

import android.accounts.Account;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.ArrayList;
import java.util.List;

/**
 * Gets a Google Drive access token WITHOUT showing any screen, as long as the
 * user already approved MHM NOTE once. Returns { needsUi: true } otherwise.
 */
@CapacitorPlugin(name = "MhmGoogle")
public class MhmGooglePlugin extends Plugin {

    @PluginMethod
    public void silentToken(PluginCall call) {
        String scope = call.getString("scope");
        String email = call.getString("email");
        if (scope == null) {
            call.reject("scope missing");
            return;
        }
        List<Scope> scopes = new ArrayList<>();
        scopes.add(new Scope(scope));
        AuthorizationRequest.Builder b = AuthorizationRequest.builder().setRequestedScopes(scopes);
        if (email != null && !email.isEmpty()) b.setAccount(new Account(email, "com.google"));
        Identity.getAuthorizationClient(getActivity())
            .authorize(b.build())
            .addOnSuccessListener((result) -> {
                JSObject ret = new JSObject();
                if (result.hasResolution() || result.getAccessToken() == null) {
                    ret.put("needsUi", true);
                } else {
                    ret.put("accessToken", result.getAccessToken());
                }
                call.resolve(ret);
            })
            .addOnFailureListener((e) -> call.reject(e.getMessage()));
    }
}
