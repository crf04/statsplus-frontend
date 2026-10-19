# PROTOTYPE — throwaway. Serves the standalone build with an SPA fallback:
#   python3 src/feedbackPrototype/serve.py [port]
import http.server, os, sys
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'build')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def send_head(self):
        if not os.path.exists(self.translate_path(self.path.split('?')[0])):
            self.path = '/index.html'
        return super().send_head()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1]) if len(sys.argv) > 1 else 4791), H).serve_forever()
