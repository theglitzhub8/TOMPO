"""Serve the Expo export and proxy its account API to the local backend."""
import argparse
from http.client import HTTPConnection
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = super().translate_path(path)
        if not Path(resolved).exists() and Path(resolved + '.html').is_file():
            return resolved + '.html'
        return resolved

    def proxy(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size > 262144:
            self.send_error(413)
            return
        connection = HTTPConnection('127.0.0.1', 8787, timeout=35)
        try:
            headers = {'Content-Type': 'application/json'}
            if self.headers.get('Authorization'):
                headers['Authorization'] = self.headers['Authorization']
            connection.request(self.command, self.path, self.rfile.read(size) if size else None, headers)
            response = connection.getresponse()
            payload = response.read()
            self.send_response(response.status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)
        except OSError:
            self.send_error(503, 'Local Tempo backend unavailable')
        finally:
            connection.close()

    def do_GET(self):
        if self.path.startswith('/v1/'):
            return self.proxy()
        return super().do_GET()

    def do_POST(self):
        if not self.path.startswith('/v1/'):
            return self.send_error(404)
        return self.proxy()

    do_PATCH = do_POST

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    parser.add_argument('--port', type=int, default=8084)
    args = parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(PreviewHandler, directory=args.directory)).serve_forever()
