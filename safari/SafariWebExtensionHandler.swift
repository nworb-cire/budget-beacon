import Foundation
import SafariServices

// No credentials or financial responses are logged or persisted by this host.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
              message["type"] as? String == "monarch-request",
              let path = message["path"] as? String,
              ["/auth/login/", "/graphql"].contains(path),
              let body = message["body"] as? [String: Any],
              let data = try? JSONSerialization.data(withJSONObject: body) else {
            reply(context, ["error": "Invalid native request."])
            return
        }
        if path == "/graphql" {
            guard body["operationName"] as? String == "BudgetBeacon",
                  let query = body["query"] as? String,
                  query.range(of: "^\\s*query\\s+BudgetBeacon\\b", options: .regularExpression) != nil,
                  query.range(of: "\\bmutation\\b", options: .regularExpression) == nil else {
                reply(context, ["error": "Only the read-only budget query is supported."])
                return
            }
        }
        var request = URLRequest(url: URL(string: "https://api.monarch.com" + path)!)
        request.httpMethod = "POST"
        request.httpBody = data
        request.timeoutInterval = 30
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("https://app.monarch.com", forHTTPHeaderField: "Origin")
        request.setValue("https://app.monarch.com/", forHTTPHeaderField: "Referer")
        request.setValue("web", forHTTPHeaderField: "monarch-client")
        request.setValue("2025.05", forHTTPHeaderField: "monarch-client-version")
        let headers = message["headers"] as? [String: String] ?? [:]
        for key in ["Authorization", "X-CSRFToken", "Cookie"] {
            if let value = headers[key], !value.contains("\r"), !value.contains("\n") {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.urlCache = nil
        let session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
        session.dataTask(with: request) { data, response, error in
            defer { session.finishTasksAndInvalidate() }
            guard error == nil, let http = response as? HTTPURLResponse else {
                self.reply(context, ["error": "Monarch network request failed."])
                return
            }
            guard let data = data, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                self.reply(context, ["error": "Monarch did not return JSON."])
                return
            }
            self.reply(context, ["status": http.statusCode, "data": object])
        }.resume()
    }

    private func reply(_ context: NSExtensionContext, _ message: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: message]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

// Credentials must never follow a redirect to another destination.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
