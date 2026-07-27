package com.bestbill.pos;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HardwareTrial")
public class HardwareTrialPlugin extends Plugin {

    @PluginMethod
    public void getHardwareInfo(PluginCall call) {
        try {
            Context context = getContext();
            String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
            if (androidId == null || androidId.isEmpty()) {
                androidId = "UNKNOWN_HW_ID";
            }

            SharedPreferences prefs = context.getSharedPreferences("bestbill_hw_trial_store", Context.MODE_PRIVATE);
            String trialStart = prefs.getString("hw_first_reg_" + androidId, "");

            JSObject ret = new JSObject();
            ret.put("hardwareId", androidId);
            ret.put("firstTrialStart", trialStart);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to fetch hardware info", e);
        }
    }

    @PluginMethod
    public void recordHardwareTrial(PluginCall call) {
        try {
            String timestamp = call.getString("timestamp");
            Context context = getContext();
            String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
            if (androidId == null || androidId.isEmpty()) {
                androidId = "UNKNOWN_HW_ID";
            }

            SharedPreferences prefs = context.getSharedPreferences("bestbill_hw_trial_store", Context.MODE_PRIVATE);
            String existing = prefs.getString("hw_first_reg_" + androidId, "");
            if (existing.isEmpty()) {
                String timeToSave = (timestamp != null && !timestamp.isEmpty()) ? timestamp : String.valueOf(System.currentTimeMillis());
                prefs.edit().putString("hw_first_reg_" + androidId, timeToSave).apply();
                existing = timeToSave;
            }

            JSObject ret = new JSObject();
            ret.put("hardwareId", androidId);
            ret.put("firstTrialStart", existing);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to record hardware trial", e);
        }
    }
}
