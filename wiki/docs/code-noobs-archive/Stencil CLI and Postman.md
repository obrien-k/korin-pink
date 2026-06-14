Installing the Stencil CLI, API requests with Postman [Video] (21:34)
--

[****UPDATE: DevDocs have been updated for Installing the Stencil CLI extensively and resolve many of the errors referred to.****](https://developer.bigcommerce.com/stencil-docs/installing-stencil-cli/installing-stencil)

This meet we talked about the steps to [install the Stencil CLI on macOS, Windows, and Linux (kind of)](https://developer.bigcommerce.com/stencil-docs/installing-stencil-cli/installing-stencil), and [some of the common pitfalls you run into](https://developer.bigcommerce.com/stencil-docs/installing-stencil-cli/troubleshooting-your-setup).

Afterwards, [we discussed the fields necessary to submit API requests](https://developer.bigcommerce.com/api-docs/getting-started/making-requests) in a [REST client](https://duckduckgo.com/?t=lm&q=rest+client) like [Postman](https://www.getpostman.com/). Focusing on the BigCommerce API for examples, when making a [POST call to the catalog/products/product_id/images](https://developer.bigcommerce.com/api-reference/catalog/catalog-api/product-images/createproductimage) endpoint, note the difference in Content-Type while using image_file instead of image_url.

Many supposed issues can be as simple as a nuance like that when making API requests. Be sure to check the requirements and example(s) when running into errors, especially if the error includes a field from the request.

****Further reading:****\
http://hayne.net/MacDev/Notes/unixFAQ.html#shellStartup

https://scriptingosx.com/2017/04/about-bash_profile-and-bashrc-on-macos/
