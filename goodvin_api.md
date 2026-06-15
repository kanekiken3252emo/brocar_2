Документация API GOODVIN

Catalogs API
 1.18.0 
OAS3
https://api.goodvin.net/v1
Open source clients:

pc-client-slim PHP based opensource client
Servers

/v1
Authorize
Ip

GET
/ip/
Get user ip

Parameters
Try it out
No parameters

Responses
Code	Description	Links
200	
Id

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "ip": "string"
}
No links
Catalogs

GET
/catalogs/
Get available catalogs

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
Responses
Code	Description	Links
200	
Ok

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "name": "string",
    "modelsCount": 0,
    "actuality": "string",
    "hasUniTree": true,
    "hasGroupTree": true,
    "hasVinCheck": true,
    "hasFrameCheck": true
  }
]
No links
Cars

GET
/catalogs/{catalogId}/models/
Get catalog car models

Parameters
Try it out
Name	Description
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
Responses
Code	Description	Links
200	
Model list

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "name": "string",
    "img": "string"
  }
]
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
404	
Not Found

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/cars2/
Get car list of catalog

Attention! Vehicle identifier may change over time.

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
modelId *
string
(query)
Model id

modelId
parameter
array[array]
(query)
Filter cars by car parameter indexes (idx)

page
integer
(query)
Page number (pagination). Page number value must be greater than 0. Can output 25 cars on page

page
Responses
Code	Description	Links
200	
OK

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "catalogId": "string",
    "name": "string",
    "description": "string",
    "modelId": "d3190764f126fabbf56bf3e36efbd56a",
    "modelName": "string",
    "modelImg": "string",
    "vin": "string",
    "frame": "string",
    "criteria": "string",
    "brand": "string",
    "groupsTreeAvailable": true,
    "parameters": [
      {
        "idx": "string",
        "key": "string",
        "name": "string",
        "value": "string",
        "sortOrder": 0
      }
    ]
  }
]
Headers:
Name	Description	Type
X-Total-Count		integer
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/cars2/{carId}
GET catalog car by id

Attention! Vehicle identifier may change over time.

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
carId *
string
(path)
Car id

carId
criteria
string
(query)
criteria

criteria
Responses
Code	Description	Links
200	
OK

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "id": "string",
  "catalogId": "string",
  "name": "string",
  "description": "string",
  "modelId": "d3190764f126fabbf56bf3e36efbd56a",
  "modelName": "string",
  "modelImg": "string",
  "vin": "string",
  "frame": "string",
  "criteria": "string",
  "brand": "string",
  "groupsTreeAvailable": true,
  "parameters": [
    {
      "idx": "string",
      "key": "string",
      "name": "string",
      "value": "string",
      "sortOrder": 0
    }
  ]
}
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/cars-parameters/
Get cars filters of selected catalog

GET
/cars/vin-validator
Checking the vin code for errors

Validation and normalization of the VIN code according to the general rules of formation

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
vin
(query)
vin
Responses
Code	Description	Links
200	
Ok

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "changed": "string",
    "original": "string",
    "errors": [
      {
        "errorCode": "VCx1700",
        "errorTranslate": "The number of characters must equal 17.",
        "details": [
          "The following characters were replaced: Q -> 0",
          "The following characters were replaced: I -> 1"
        ]
      }
    ]
  }
]
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/car/info
Get car info by VIN or FRAME

You may specify VIN or FRAME number in query. Attention! Vehicle identifier may change over time.

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
q
string
(query)
Automatically detects type of input data and performs search of cars by VIN or FRAME number depending on input data

q
catalogs
string
(query)
List of comma-separated Catalog IDs for search by vin or frame in selected catalogs

kia,bmw,chevrolet,hyundai
Responses
Code	Description	Links
200	
Ok

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "title": "string",
    "catalogId": "string",
    "brand": "string",
    "modelId": "5bb58a3cab059a189ef92be181380fd5",
    "carId": "string",
    "criteria": "string",
    "vin": "string",
    "frame": "string",
    "modelName": "string",
    "description": "string",
    "groupsTreeAvailable": true,
    "optionCodes": [
      {
        "code": "string",
        "description": "string"
      }
    ],
    "parameters": [
      {
        "idx": "string",
        "key": "string",
        "name": "string",
        "value": "string",
        "sortOrder": 0
      }
    ]
  }
]
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
Groups

GET
/catalogs/{catalogId}/groups2/
Get catalog groups

With empty identifier shows main groups of catalog. It is necessary to select groups by ID until the "hasParts" value is true. The "hasParts" value indicates that the group contains spare parts. The list of spare parts can be received by the method parts2.

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
carId *
string
(query)
carId
groupId
string
(query)
Group id

groupId
criteria
string
(query)
Filters outcoming groups depending on criteria string. Criteria string can obtain from "car/info" method

criteria
Responses
Code	Description	Links
200	
Catalog groups

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "MfCfmoAxMjI4fEE",
    "hasSubgroups": true,
    "hasParts": false,
    "name": "Accessories",
    "img": "//img.example.com/r/250x250/land_rover_2014_12/1228/A.png",
    "description": ""
  },
  {
    "id": "IzLwn5qAMTIyOHxB8J-agUEwMfCfmoJBMDEwMDV8TFQwMTIwPD4",
    "hasSubgroups": false,
    "hasParts": true,
    "name": "Auxiliary Lighting-Fog Lamps",
    "img": "//img.example.com/r/250x250/land_rover_2014_12/1228/lt0120().png",
    "description": ""
  }
]
getSubgroups
If parameter hasParts: false

Operation `getGroups`

Parameters {
  "catalogId": "$request.path.catalogId",
  "carId": "$request.query.carId",
  "groupId": "$response.body#/0/id",
  "criteria": "$request.query.criteria"
}
getParts
If parameter hasParts: true

Operation `getParts`

Parameters {
  "catalogId": "$request.path.catalogId",
  "carId": "$request.query.carId",
  "groupId": "$response.body#/0/id",
  "criteria": "$request.query.criteria"
}
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
404	
Not Found

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/groups-suggest
Get group suggest.

Suggest parts with relative to group id

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
q *
string
(query)
First letters of searching part

Example : bat

bat
Responses
Code	Description	Links
200	
Suggest list

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "sid": "12345",
    "name": "battery"
  }
]
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
404	
Search string is empty

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/groups-by-sid
Get groups by search id.

Warning: Deprecated
Get groups by search id

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
sid *
string
(query)
Search id from group suggest

Example : 12345

12345
carId *
string
(query)
Car id

carId
criteria
string
(query)
Additional criteria string

criteria
text
string
(query)
This field is the name of the part. After searching for groups by sid, we can sort the groups by text, where there may be a part with this name.

text
Responses
Code	Description	Links
200	
Suggest list

Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "parentId": "string",
    "hasSubgroups": true,
    "hasParts": true,
    "name": "string",
    "img": "string",
    "description": "string"
  }
]
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
404	
Search string is empty

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
Parts

GET
/catalogs/{catalogId}/parts2
Get catalog parts.

Get catalog parts. In case you receive IDs of groups with the value "hasParts=false", you get error 400 (No details found with specified parameters).

Parameters
Try it out
Name	Description
Accept-Language
string
(header)
Language of return data

Available values : en, ru, de, bg, fr, es, he

Default value : en


en
x-redirect-template
string
(header)
Template for your gui url. In template must be 2 templates separated by commas for go to group list and parts list. If vin is not used, then you do not need to pass criteria and vin to the template.

parts <a href="#/parts?catalogId=%catalogId%&modelId=%modelId%&carId=%carId%&groupId=%groupId%&q=%vin%&criteria=%criteria%">%text%</a>, groups <a href="#/groups?catalogId=%catalogId%&modelId=%modelId%&carId=%carId%&groupsPath=%groupId%&q=%vin%&criteria=%criteria%">%text%</a>
catalogId *
string
(path)
Catalog id

Default value : bmw

bmw
carId *
string
(query)
Car id

carId
groupId *
string
(query)
Group id

groupId
criteria
string
(query)
Additional criteria string

criteria
Responses
Code	Description	Links
200	
Parts list

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "img": "string",
  "imgDescription": "string",
  "brand": "string",
  "partGroups": [
    {
      "name": "string",
      "number": "string",
      "positionNumber": "string",
      "description": "string",
      "parts": [
        {
          "id": "string",
          "nameId": "string",
          "name": "string",
          "number": "string",
          "notice": "string",
          "description": "string",
          "positionNumber": "string",
          "url": "string"
        }
      ]
    }
  ],
  "positions": [
    {
      "number": "string",
      "coordinates": [
        0,
        0,
        0,
        0
      ]
    }
  ]
}
No links
400	
Bad Request

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
403	
Access deny

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
404	
No details found with specified parameters

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
Groups tree
Attention! You must use the groups2 and parts2 methods for truck catalogs.


GET
/catalogs/{catalogId}/groups-tree

Get groups tree

Parameters
Try it out
Name	Description
catalogId *
string
(path)
catalogId
carId
string
(query)
carId
criteria
string
(query)
criteria
cached
boolean
(query)
A flag that determines whether the general unfiltered group tree should be retrieved from the cache or filtered tree with increased latency should be retrieved.


--
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "name": "string",
    "parentId": "string",
    "subGroups": [
      {
        "id": "string",
        "name": "string",
        "parentId": "string",
        "subGroups": []
      }
    ]
  }
]
No links
default	
Any error 400 - 500

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
GET
/catalogs/{catalogId}/schemas

Get schemas that lead to detail pages.

Parameters
Try it out
Name	Description
carId *
string
(query)
carId
branchId
string
(query)
Id for filter schemas by branch id. Branch id it is group id.

branchId
criteria
string
(query)
criteria
page
integer
(query)
The page number. One response can contain a maximum of 24 elements.

Default value : 0

0
partNameIds
string
(query)
Part name ids for filter schemas

Example : 56,85

56,85
partName
string
(query)
Part name for filter schemas

Example : Air filter

Air filter
catalogId *
string
(path)
toyota
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "group": {
    "id": "string",
    "parentId": "string",
    "hasSubgroups": true,
    "hasParts": true,
    "name": "string",
    "img": "string",
    "description": "string"
  },
  "list": [
    {
      "groupId": "IzLwn5qAMDA08J-agTg0RTQyOULwn5SwMjI18J-QkjU4NfCfkIk4NEU0MjlC",
      "img": "//img.parts-catalogs.com/toyota_2022_12/usa/84E429B.png",
      "name": "ENGINE & TRANSMISSION ILLUST NO. 1 OF 7",
      "description": "",
      "partNames": [
        {
          "id": "string",
          "name": "string"
        }
      ]
    }
  ]
}
Headers:
Name	Description	Type
X-Total-Count	
The total number of items available for extraction.

integer
No links
default	
Any error 400 - 500

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
Example

GET
/example/prices
Get prices of part

This endpoint is a demonstration example showing how to retrieve information about prices and availability of parts by unique product code and brand. It is intended for developers and API architects as an illustration of potential functionality, not as a ready-to-use solution for production environments.

Parameters
Try it out
Name	Description
code *
string
(query)
code
brand *
string
(query)
brand
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "id": "string",
    "title": "string",
    "code": "string",
    "brand": "string",
    "price": "string",
    "basketQty": "string",
    "inStockQty": "string",
    "rating": "string",
    "delivery": "string",
    "payload": {
      "additionalProp1": "string",
      "additionalProp2": "string",
      "additionalProp3": "string"
    }
  }
]
No links
default	
Any error 400 - 500

Media type

application/json
Example Value
Schema
{
  "code": 0,
  "errorCode": "string",
  "message": "string"
}
No links
Schemas
Ip{
ip	[...]
}
CarParameterInfo{
key	[...]
name	[...]
values	[...]
sortOrder	[...]
}
CarParameterIdxstring
Index of car parameter (idx)

Parts{
description:	
Parts description

img*	[...]
imgDescription	[...]
brand	[...]
partGroups*	[...]
positions	[...]
}
PartsGroup{
description:	
Parts group

name	[...]
number	[...]
positionNumber	[...]
description	[...]
parts*	[...]
}
Group{
description:	
Group

id*	[...]
parentId	[...]
hasSubgroups	[...]
hasParts	[...]
name*	[...]
img	[...]
description	[...]
}
Car2{
description:	
Car

id*	[...]
catalogId*	[...]
name*	[...]
description	[...]
modelId	[...]
modelName	[...]
modelImg	[...]
vin	[...]
frame	[...]
criteria	[...]
brand	[...]
groupsTreeAvailable	[...]
parameters	[...]
}
Car filter{
description:	
The values of the specific complectation parameter

name	{...}
values	[...]
}
Models{
description:	
Car model

id*	[...]
name*	[...]
img	[...]
}
Catalog{
id*	[...]
name*	[...]
modelsCount*	[...]
actuality*	[...]
hasUniTree*	[...]
hasGroupTree*	[...]
hasVinCheck*	[...]
hasFrameCheck*	[...]
}
Error{
description:	
Error response to request

code*	[...]
errorCode	[...]
message*	[...]
}
CarValidate{
changed	[...]
original	[...]
errors	[...]
}
CarInfo{
title	[...]
catalogId	[...]
brand	[...]
modelId	[...]
carId	[...]
criteria	[...]
vin	[...]
frame	[...]
modelName	[...]
description	[...]
groupsTreeAvailable	[...]
optionCodes	[...]
parameters	[...]
}
Part{
description:	
Part

id	[...]
nameId	[...]
name	[...]
number	[...]
notice	[...]
description	[...]
positionNumber	[...]
url	[...]
}
Suggest{
description:	
suggest

sid	[...]
name	[...]
}
ExamplePricesResponse{
id	[...]
title	[...]
code	[...]
brand	[...]
price	[...]
basketQty	[...]
inStockQty	[...]
rating	[...]
delivery	[...]
payload	{...}
}
SchemasResponse{
group	{...}
nullable: true
list	[...]
}
Schema{
groupId	[...]
img	[...]
name	[...]
description	[...]
partNames	[...]
}
PartName{
id	[...]
name	[...]
}
GroupsTreeResponse{
id	[...]
name	[...]
parentId	[...]
subGroups	[...]
}
GroupsTree{
id	[...]
name	[...]
parentId	[...]
subGroups	[...]
}