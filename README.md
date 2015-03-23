Site Image
==========

Uses Restify and PhantomJS to allow capturing URL screenshots

Installation
============

npm install

Running
=======

npm start

Accessible on port 3000 by default, configurable

Testing
=======

Assumes shell access and cURL being present

 * Make sure that instance is running on http://localhost:3000
 * Navigate into the app directory
 * Type in "sh test.sh", this will create a test_results direcotry
 * Go to the created directory and check out the resulting images

GOTCHAS
=======

 * Sometimes setting viewportSize will not be enough for the page to provide a mobile version (the real size will differ), plus the captured image height might differ from Viewport Height, this is why clipRect is being used. In case of Web Pages that are not responsive in nature, the taken image might then just be a fracture of the whole page. In that case it is better to request a bigger size for the capture and resize it as necessary.
 * A pool of PhantomJS instances is used by the server. It seems that the acquire() call of the Pool library is not throwing exception of an instance can not be acquired. Probably will wait for as long as possible and then time out.

TODO
====

 * Make sure that running multiple PhantomJS instances at the same time is possible without explicitly setting different ports to be used (seems running just fine but should probably be battle tested)
 * Better handling of errors
 * Need to make sure how does it behave under load (especially how PhantomJS behaves under heavy load)
 * Better documentation
 * Cache for already loaded images (provided all the parameters are the same)
 * Better test cases that would emulate heavy load

 LICENSE
 =======

 MIT
