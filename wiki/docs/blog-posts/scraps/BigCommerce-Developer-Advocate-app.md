---
layout: page
title: How to Build Your First BigCommerce App
permalink: /BigCommerce-Developer-Advocate-app/
---

# How to Build Your First BigCommerce App

## Introduction

Developing your first app for a platform is an exhilarating experience -- you discover new technologies that would unlock abilities for your team or nuances that could affect your application idea.

Developers who find our development environment to be their second home can sometimes have trouble constructing ideas of possible apps or tweaks merchants would be interested in. I recommend checking out [BigCommerce Ideas](https://support.bigcommerce.com/s/ideas). This is a great resource for BigCommerce developers to review incoming suggestions that might be fulfilled by your development work!

Once you have your app idea, you can start working on it using one of the [BigCommerce API clients](https://developer.bigcommerce.com/tools-resources). For example, you might use a GET request on the [/v3/catalog/products endpoint](https://developer.bigcommerce.com/api-reference/store-management/catalog/products/getproducts) to retrieve your store's products. For more info on working with the BigCommerce API, check out [our Dev Center's API docs](https://developer.bigcommerce.com/api-docs).

After imagining, designing, and optimizing your app idea, the last hurdle you would want to encounter is a lengthy application integration process. BigCommerce enables developers to expedite this process with applications on our platform, and today I'll show you how you can build your first app for our App Marketplace.

## Authorization with OAuth

There are two different types of application on the [BigCommerce App Marketplace](http://bigcommerce.com/apps), Single-Click Apps and Connector Apps. Connector apps use a manual OAuth token, unlike the Single-Click flow, and we recommend developing the Single-Click flow unless in a [few choice scenarios](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/types-of-apps#connector-apps). You can find more info about the [types of apps offered here](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/types-of-apps). We'll focus on the OAuth flow for this example which can be [found here](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/building-apps#installation-and-update-sequence).

Our docs do an excellent job of explaining the technical details for this process, and this flow is the capital diagram to align your own application's authorization process. The first step is to create a callback request for authorization, a requirement for all BigCommerce Apps. A prerequisite for this request is that your /auth endpoint must be publicly available, fully qualified, and served over TLS. You should also have access to logs sent through this endpoint on your app so that you can see what the response was.

This step occurs when the merchant clicks "Install" and sends details like a temporary token, scopes, and other necessary info. Once you receive and respond to the /auth request with the GET HTTP method, your app needs to send a POST request programmatically with the `code`, `client_id`, and `client_secret` to BigCommerce. From there, BigCommerce will respond with your app's OAuth token for that store. The `store_hash` and `access_token` should be stored somewhere secure to avoid losing authorization. You should also store the user ID, user email, and any scopes (such as initial or renewed scopes). It's worth noting that tokens are invalidated when your app receives a new one, for example, when updating scopes. You can find more about these initial steps on [the Dev Center here](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/building-apps#receiving-the-get-request).

If you're still percolating on your app idea, I want to share that these details can be manually entered. This can be poignant if you're looking to try out the platform. When building an application, this should be one of the last steps you complete as it requires many of the proceeding steps in the flow to be functional.

## The Load Callback

There's one other required callback request for BigCommerce apps: the /load callback URI is requested when merchants click on your app from their control panel. This is where most of your time is spent working on an app as a dev. This is where your prospective clients will interact with your app's User Interface (UI). BigCommerce recommends using [BigDesign components](https://developer.bigcommerce.com/big-design/) to build your UI using React. BigDesign is our library and guidebook for native-feeling BigCommerce applications. There are also conversion libraries available if you're not yet familiar with React like this [Angular project from Microsoft](https://github.com/microsoft/angular-react).

Your app will need to [process a signed payload](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/building-apps#processing-the-signed-payload) when this endpoint is called and then return the app UI as HTML. These steps should generally be the same as it relates to security, but the embedded JSON object will contain info about the BigCommerce store and owner (or user if an app with multi-user support). You can use the Store Information endpoint to identify the store each request pertains to, and more info about this endpoint can be [found here](https://developer.bigcommerce.com/api-reference/store-management/store-information-api/store-information/getstore). I've also attached an example of what this payload looks like from our Dev Center doc:

```json
{
  "user": {
    "id": 9128,
    "email": "user@mybigcommerce.com"
  },
  "owner": {
    "id": 9128,
    "email": "user@mybigcommerce.com"
  },
  "context": "stores/z4zn3wo",
  "store_hash": "z4zn3wo",
  "timestamp": 1469823892.9123988
}
```
## Unrequired Callback URIs

Where does this leave the [two remaining Callback URIs](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/building-apps#required-uris) listed on the BigCommerce Dev Center? The Uninstall and Remove User callbacks aren't required, but I recommend creating an uninstall callback if your app will be listed on the App Marketplace. A store owner can uninstall an app at any time which revokes the OAuth token for that app. This will allow you to initiate cleanup actions like removing the store info from your system.

The Remove User flow is only recommended for apps with multi-user support, which would be called when a Store Owner removes access for an app from a specific user on their store. This similarly allows you to begin cleanup actions for the user with revoked access.

## Next Steps

After completing these initial callback requests successfully, you might be interested in the alluded to multi-user app. Once you've enabled multi-user support for your app, the control panel of any store that has your app installed will be affected. Enabling multi-user is out of scope for this article but if you have a published app, we recommend testing your multi-user support with a separate app in draft status. More info about multi-user support can be found on the [BigCommerce Dev Center](https://developer.bigcommerce.com/api-docs/getting-started/building-apps-bigcommerce/building-apps#multi-user-support).

If your app is ready for primetime and you want to list it to our App Marketplace, you'll need to apply to become a Technology Partner with BigCommerce, and more info about this can be found on the [BigCommerce website](https://www.bigcommerce.com/partners/become-a-partner/). You'll work within the Dev Tools workspace to develop Single-Click apps like this, and for more info about the App Marketplace approval process [check out this doc on our Dev Center](https://developer.bigcommerce.com/api-docs/partner/app-store-approval-requirements).

Conclusion

Creating an app of any kind can be an involved task but building your first in a new environment will always be strange. With the BigCommerce platform we try to create a familiar flow with our authorization process and I hope this article made it feel more at home for fresh faces to our community.

What apps have you been working on lately? Have you tried the latest package from [BigDesign](https://github.com/bigcommerce/big-design) with your UIs? Tell me in the comments or on X [@kyle_o](https://x.com/kyle_o).