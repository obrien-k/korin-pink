Introduction to Document Object Model, DOM manipulation with JS
--

The DOM (Document Object Model) is an [API](https://developer.mozilla.org/en-US/docs/Glossary/API) that represents and interacts with any [HTML](https://developer.mozilla.org/en-US/docs/Glossary/HTML) or [XML](https://developer.mozilla.org/en-US/docs/Glossary/XML) document. The DOM is a document model loaded in the [browser](https://developer.mozilla.org/en-US/docs/Glossary/browser) and representing the document as a node tree, where each node represents part of the document (e.g. an [element](https://developer.mozilla.org/en-US/docs/Glossary/element), text string, or comment).

The DOM is one of the most-used [API](https://developer.mozilla.org/en-US/docs/Glossary/API)s on the [Web](https://developer.mozilla.org/en-US/docs/Glossary/World_Wide_Web) because it allows code running in a browser to access and interact with every node in the document. Nodes can be created, moved and changed. Event listeners can be added to nodes and triggered on occurrence of a given event.DOM was not originally specified---it came about when browsers began implementing [JavaScript](https://developer.mozilla.org/en-US/docs/Glossary/JavaScript). This legacy DOM is sometimes called DOM 0. Today, the WHATWG maintains the DOM Living Standard.

HTML - Structure of Site

[XML](https://www.w3.org/TR/REC-xml/) - For use with programs and database-like systems

[JSON - The Fat-Free Alternative to XML](https://www.json.org/xml.html)

[A StackOverflow response detailing the differences between JSON and XML](https://stackoverflow.com/questions/2620270/what-is-the-difference-between-json-and-xml#2620466)

Browser - document.defaultView

![](http://24.144.82.201/content/images/2018/12/unnamed.png)

Anatomy of an HTML element

Elements and tags are not the same things. Tags begin or end an element in source code, whereas elements are part of the DOM, the document model for displaying the page in the browser.

Before we hit the DOM, let's discuss CSS for a moment: it's the styling of the page, but can also be more than that. Animations are done through CSS, and UX is always a concern. That's all to be said about that for now, but the example we look at will use CSS in conjunction with JS.

An API is an interface for various functions that you deem appropriate for your application, functions in terms of JavaScript are defined by MDN below:

A ****function**** is a code snippet that can be called by other code or by itself, or a [variable](https://developer.mozilla.org/en-US/docs/Glossary/variable) that refers to the function. When a function is called, [arguments](https://developer.mozilla.org/en-US/docs/Glossary/Argument) are passed to the function as input, and the function can optionally return an output. A function in [JavaScript](https://developer.mozilla.org/en-US/docs/Glossary/JavaScript) is also an [object](https://developer.mozilla.org/en-US/docs/Glossary/object).

```
function add(x, y)
{
   return(x + y);
}
add(2, 3);

```

**Note: You do need to call the function, seen with* *add(2, 3);

****Document Object Model****

The DOM is a complex and complicated structure that holds together the HTML as you see it in front of you, and as explained above is the integral API that JavaScript utilizes to interact with the web.

****Document**** and ****window**** objects are the objects whose interfaces you generally use most often in DOM programming. In simple terms, the window object represents something like the browser, and the document object is the root of the document itself.

JavaScript is like the muscle of the internet, it allows you to do things like addEventListener():

```
buttonElement.addEventListener('click', {
  handleEvent: function (event) {
    alert('Element clicked through handleEvent property!');
  }
var buttonElement = document.getElementById('btn');

// Add a handler for the 'click' event by providing a callback function.
// Whenever the element is clicked, a pop-up with "Element clicked!" will
// appear.
buttonElement.addEventListener('click', function (event) {
  alert('Element clicked through function!');
});

// For compatibility, a non-function object with a `handleEvent` property is
// treated just the same as a function itself.

});

```

The Great RGB Color Game
------------------------

This will be our first project, and if you're simply following along I recommend to check out the course where I learned how to do this. [I gave it 5 stars on Udemy, and Colt Steele seems the most qualified to provide this information as he's lectured actual bootcamps.](https://www.udemy.com/the-web-developer-bootcamp/) There's an Advanced Dev bootcamp on his page as well.