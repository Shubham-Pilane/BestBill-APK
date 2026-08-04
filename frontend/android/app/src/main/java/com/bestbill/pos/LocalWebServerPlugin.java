package com.bestbill.pos;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "LocalWebServer")
public class LocalWebServerPlugin extends Plugin {
    private static ServerSocket serverSocket = null;
    private static boolean isRunning = false;
    private static final int SERVER_PORT = 8080;
    private static final List<SocketWriter> connectedClients = Collections.synchronizedList(new ArrayList<>());

    private static final ConcurrentHashMap<String, CountDownLatch> pendingLatches = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, String> pendingResponses = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Integer> pendingStatusCodes = new ConcurrentHashMap<>();

    @Override
    public void load() {
        super.load();
    }

    @PluginMethod
    public void getLocalIpAddress(PluginCall call) {
        try {
            String ip = getIpAddress();
            JSObject ret = new JSObject();
            ret.put("ip", ip);
            ret.put("port", SERVER_PORT);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get local IP address", e);
        }
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            startServerInternal();
            JSObject ret = new JSObject();
            ret.put("status", "running");
            ret.put("ip", getIpAddress());
            ret.put("port", SERVER_PORT);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start server", e);
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        try {
            stopServerInternal();
            JSObject ret = new JSObject();
            ret.put("status", "stopped");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop server", e);
        }
    }

    @PluginMethod
    public void setApiResponse(PluginCall call) {
        String reqId = call.getString("reqId");
        Integer status = call.getInt("status");
        String data = call.getString("data");

        if (reqId != null) {
            if (status != null) {
                pendingStatusCodes.put(reqId, status);
            }
            if (data != null) {
                pendingResponses.put(reqId, data);
            }
            CountDownLatch latch = pendingLatches.get(reqId);
            if (latch != null) {
                latch.countDown();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void broadcastEvent(PluginCall call) {
        if (!isRunning) {
            JSObject ret = new JSObject();
            ret.put("broadcasted", false);
            call.resolve(ret);
            return;
        }

        String event = call.getString("event");
        String data = call.getString("data");
        if (event == null) event = "update";
        String payload = "event: " + event + "\ndata: " + (data != null ? data : "{}") + "\n\n";

        synchronized (connectedClients) {
            List<SocketWriter> toRemove = new ArrayList<>();
            for (SocketWriter sw : connectedClients) {
                if (!sw.write(payload)) {
                    toRemove.add(sw);
                }
            }
            connectedClients.removeAll(toRemove);
        }
        JSObject ret = new JSObject();
        ret.put("broadcasted", true);
        call.resolve(ret);
    }

    private void startServerInternal() {
        if (isRunning) return;
        isRunning = true;
        new Thread(() -> {
            try {
                serverSocket = new ServerSocket(SERVER_PORT);
                while (isRunning && serverSocket != null && !serverSocket.isClosed()) {
                    Socket clientSocket = serverSocket.accept();
                    new Thread(new ClientHandler(clientSocket)).start();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void stopServerInternal() {
        isRunning = false;
        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
        } catch (Exception ignored) {}
        serverSocket = null;
        connectedClients.clear();
    }

    private String getIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress()) {
                        String sAddr = addr.getHostAddress();
                        if (sAddr != null && sAddr.indexOf(':') < 0) { // IPv4 address
                            return sAddr;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }

    private interface SocketWriter {
        boolean write(String data);
    }

    private class ClientHandler implements Runnable {
        private final Socket socket;

        public ClientHandler(Socket socket) {
            this.socket = socket;
        }

        @Override
        public void run() {
            try {
                InputStream is = socket.getInputStream();
                OutputStream os = socket.getOutputStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));

                String requestLine = reader.readLine();
                if (requestLine == null || requestLine.isEmpty()) {
                    socket.close();
                    return;
                }

                String[] tokens = requestLine.split(" ");
                if (tokens.length < 2) {
                    socket.close();
                    return;
                }

                String method = tokens[0];
                String path = tokens[1];

                String line;
                int contentLength = 0;
                String authHeader = "";
                while ((line = reader.readLine()) != null && !line.isEmpty()) {
                    if (line.toLowerCase().startsWith("content-length:")) {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    } else if (line.toLowerCase().startsWith("authorization:")) {
                        authHeader = line.substring(14).trim();
                    }
                }

                if ("OPTIONS".equalsIgnoreCase(method)) {
                    String headers = "HTTP/1.1 200 OK\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n" +
                            "Access-Control-Allow-Headers: *\r\n" +
                            "Content-Length: 0\r\n\r\n";
                    os.write(headers.getBytes());
                    os.flush();
                    socket.close();
                    return;
                }

                // Read body if POST/PUT
                String body = "";
                if (contentLength > 0) {
                    char[] charArray = new char[contentLength];
                    int read = 0;
                    while (read < contentLength) {
                        int r = reader.read(charArray, read, contentLength - read);
                        if (r == -1) break;
                        read += r;
                    }
                    body = new String(charArray);
                }

                // Handle API Endpoints
                if (path.startsWith("/api/")) {
                    if ("/api/events".equals(path) || "/events".equals(path)) {
                        String sseHeaders = "HTTP/1.1 200 OK\r\n" +
                                "Content-Type: text/event-stream\r\n" +
                                "Cache-Control: no-cache\r\n" +
                                "Connection: keep-alive\r\n" +
                                "Access-Control-Allow-Origin: *\r\n\r\n";
                        os.write(sseHeaders.getBytes());
                        os.flush();

                        SocketWriter writer = data -> {
                            try {
                                os.write(data.getBytes());
                                os.flush();
                                return true;
                            } catch (Exception e) {
                                return false;
                            }
                        };

                        connectedClients.add(writer);
                        return;
                    }

                    String reqId = UUID.randomUUID().toString();
                    CountDownLatch latch = new CountDownLatch(1);
                    pendingLatches.put(reqId, latch);

                    final String reqMethod = method;
                    final String reqPath = path;
                    final String reqBody = body;
                    final String reqAuth = authHeader;

                    getActivity().runOnUiThread(() -> {
                        try {
                            String escapedBody = reqBody.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
                            String escapedAuth = reqAuth.replace("\\", "\\\\").replace("'", "\\'");
                            String jsCode = "if (window.executeApiBridge) { window.executeApiBridge('" + reqId + "', '" + reqMethod + "', '" + reqPath + "', '" + escapedBody + "', '" + escapedAuth + "'); }";
                            getBridge().getWebView().evaluateJavascript(jsCode, null);
                        } catch (Exception e) {
                            latch.countDown();
                        }
                    });

                    try {
                        latch.await(5, TimeUnit.SECONDS);
                    } catch (Exception ignored) {}

                    pendingLatches.remove(reqId);
                    Integer statusObj = pendingStatusCodes.remove(reqId);
                    int statusCode = statusObj != null ? statusObj : 200;
                    String responseData = pendingResponses.remove(reqId);
                    if (responseData == null) {
                        responseData = "{\"message\":\"API Timeout or Error\"}";
                        statusCode = 500;
                    }

                    byte[] respBytes = responseData.getBytes("UTF-8");
                    String httpHeader = "HTTP/1.1 " + statusCode + " OK\r\n" +
                            "Content-Type: application/json; charset=utf-8\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n" +
                            "Access-Control-Allow-Headers: *\r\n" +
                            "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                            "Pragma: no-cache\r\n" +
                            "Expires: 0\r\n" +
                            "Content-Length: " + respBytes.length + "\r\n\r\n";

                    os.write(httpHeader.getBytes("UTF-8"));
                    os.write(respBytes);
                    os.flush();
                    socket.close();
                    return;
                }

                // Serve Static Web Assets
                Context context = getContext();
                String assetPath = path.contains("?") ? path.substring(0, path.indexOf("?")) : path;
                if (assetPath.startsWith("/")) assetPath = assetPath.substring(1);
                if (assetPath.isEmpty()) assetPath = "index.html";

                byte[] fileBytes = null;
                String mimeType = getMimeType(assetPath);

                try {
                    InputStream assetStream = context.getAssets().open("public/" + assetPath);
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] data = new byte[8192];
                    int nRead;
                    while ((nRead = assetStream.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    buffer.flush();
                    fileBytes = buffer.toByteArray();
                    assetStream.close();
                } catch (Exception e) {
                    if (!assetPath.startsWith("api/") && !assetPath.contains(".")) {
                        try {
                            InputStream assetStream = context.getAssets().open("public/index.html");
                            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                            byte[] data = new byte[8192];
                            int nRead;
                            while ((nRead = assetStream.read(data, 0, data.length)) != -1) {
                                buffer.write(data, 0, nRead);
                            }
                            buffer.flush();
                            fileBytes = buffer.toByteArray();
                            mimeType = "text/html; charset=utf-8";
                            assetStream.close();
                        } catch (Exception ignored) {}
                    }
                }

                if (fileBytes != null) {
                    String httpResponse = "HTTP/1.1 200 OK\r\n" +
                            "Content-Type: " + mimeType + "\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                            "Pragma: no-cache\r\n" +
                            "Expires: 0\r\n" +
                            "Content-Length: " + fileBytes.length + "\r\n\r\n";
                    os.write(httpResponse.getBytes());
                    os.write(fileBytes);
                    os.flush();
                } else {
                    String notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                    os.write(notFound.getBytes());
                    os.flush();
                }
                socket.close();
            } catch (Exception e) {
                try { socket.close(); } catch (Exception ignored) {}
            }
        }

        private String getMimeType(String filename) {
            if (filename.endsWith(".html") || filename.endsWith(".htm")) return "text/html; charset=utf-8";
            if (filename.endsWith(".js") || filename.endsWith(".mjs")) return "application/javascript";
            if (filename.endsWith(".css")) return "text/css";
            if (filename.endsWith(".json")) return "application/json";
            if (filename.endsWith(".png")) return "image/png";
            if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
            if (filename.endsWith(".svg")) return "image/svg+xml";
            if (filename.endsWith(".ico")) return "image/x-icon";
            if (filename.endsWith(".woff2")) return "font/woff2";
            return "text/plain";
        }
    }
}
