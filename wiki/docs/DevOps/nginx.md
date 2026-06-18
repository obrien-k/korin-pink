nginx
--

nginx is a service for proxying other services, apps, and web pages to IP addresses, etc.

This page is primarily so kai doesn't forget how to configure nginx to serve SPAs again. The following code block is intended for the nginx.conf file, or the equivalent for a specific site. It ensures that all pages are rendered using the /build/index.html file, `/build` being the SPA's root directory.

```
location / {
	try_files $uri $uri/ /build/index.html;
}
```