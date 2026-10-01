package com.budgetrent.ph;

import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;

import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Sinisilip kung naka-on ang Location (GPS) ng phone mismo — iba ito sa app permission.
@CapacitorPlugin(name = "DeviceLocation")
public class DeviceLocationPlugin extends Plugin {

    @PluginMethod
    public void isEnabled(PluginCall call) {
        LocationManager lm = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        JSObject ret = new JSObject();
        ret.put("enabled", lm != null && LocationManagerCompat.isLocationEnabled(lm));
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
