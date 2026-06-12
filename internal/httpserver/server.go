package httpserver

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	h3 "github.com/quic-go/quic-go/http3"
)

// Options configures a dual-stack listener: TCP (HTTP/1.1, optional HTTP/2)
// and, when TLS is configured, UDP (HTTP/3).
type Options struct {
	Addr      string
	Handler   http.Handler
	CertFile  string
	KeyFile   string
	TLSConfig *tls.Config
	HTTP3     bool
}

// Listener serves a shared http.Handler over TCP and optionally HTTP/3.
type Listener struct {
	tcpAddr net.Addr
	http    *http.Server
	h3      *h3.Server
	wg      sync.WaitGroup
	errCh   chan error
	once    sync.Once
}

func (o Options) tlsEnabled() bool {
	return o.TLSConfig != nil || (o.CertFile != "" && o.KeyFile != "")
}

func (o Options) http3Enabled() bool {
	if !o.tlsEnabled() {
		return false
	}
	return o.HTTP3
}

// Listen starts serving handler on addr. Returns the bound TCP address.
func Listen(opts Options) (*Listener, error) {
	if opts.Handler == nil {
		return nil, errors.New("httpserver: Handler is required")
	}
	if opts.Addr == "" {
		opts.Addr = ":8080"
	}

	httpSrv := &http.Server{
		Handler: opts.Handler,
	}

	l := &Listener{
		http:  httpSrv,
		errCh: make(chan error, 2),
	}

	if opts.tlsEnabled() {
		if err := l.configureTLS(opts); err != nil {
			return nil, err
		}
	}

	tcpLn, err := net.Listen("tcp", opts.Addr)
	if err != nil {
		return nil, fmt.Errorf("listen tcp %s: %w", opts.Addr, err)
	}
	l.tcpAddr = tcpLn.Addr()

	if opts.http3Enabled() {
		l.h3 = &h3.Server{
			Addr:      l.tcpAddr.String(),
			Handler:   opts.Handler,
			TLSConfig: httpSrv.TLSConfig,
		}
		l.wg.Add(1)
		go func() {
			defer l.wg.Done()
			if err := l.h3.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				l.errCh <- fmt.Errorf("http3: %w", err)
			}
		}()
	}

	l.wg.Add(1)
	go func() {
		defer l.wg.Done()
		var err error
		if opts.tlsEnabled() {
			err = httpSrv.ServeTLS(tcpLn, opts.CertFile, opts.KeyFile)
		} else {
			err = httpSrv.Serve(tcpLn)
		}
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			l.errCh <- fmt.Errorf("http: %w", err)
		}
	}()

	return l, nil
}

func (l *Listener) configureTLS(opts Options) error {
	cfg := opts.TLSConfig
	if cfg == nil {
		cert, err := tls.LoadX509KeyPair(opts.CertFile, opts.KeyFile)
		if err != nil {
			return fmt.Errorf("load tls cert: %w", err)
		}
		cfg = &tls.Config{
			Certificates: []tls.Certificate{cert},
			MinVersion:   tls.VersionTLS13,
			NextProtos:   []string{"h3", "h2", "http/1.1"},
		}
	} else {
		cfg = cfg.Clone()
		if cfg.MinVersion == 0 {
			cfg.MinVersion = tls.VersionTLS13
		}
		if len(cfg.NextProtos) == 0 {
			cfg.NextProtos = []string{"h3", "h2", "http/1.1"}
		}
	}
	l.http.TLSConfig = cfg
	return nil
}

func (l *Listener) Addr() net.Addr {
	if l == nil || l.tcpAddr == nil {
		return nil
	}
	return l.tcpAddr
}

func (l *Listener) Err() <-chan error {
	return l.errCh
}

// Shutdown gracefully stops HTTP and HTTP/3 listeners.
func (l *Listener) Shutdown(ctx context.Context) error {
	if l == nil {
		return nil
	}
	var err error
	l.once.Do(func() {
		if l.h3 != nil {
			if closeErr := l.h3.Close(); closeErr != nil {
				err = errors.Join(err, closeErr)
			}
		}
		if l.http != nil {
			if shutErr := l.http.Shutdown(ctx); shutErr != nil {
				err = errors.Join(err, shutErr)
			}
		}
		l.wg.Wait()
	})
	return err
}

// DefaultShutdownTimeout is used when callers pass a nil context.
const DefaultShutdownTimeout = 5 * time.Second

func ShutdownContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent != nil {
		return context.WithTimeout(parent, DefaultShutdownTimeout)
	}
	return context.WithTimeout(context.Background(), DefaultShutdownTimeout)
}
