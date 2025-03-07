<div style="display: flex; justify-content: space-between; align-items: flex-start;">
  <img src="https://media.licdn.com/dms/image/v2/D4D03AQHxXbXeM_z1DA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1727299483731?e=1744848000&v=beta&t=IqXJPILyd7pGjiDnPoMXoo4CpTQ_hrVdLQLNcNyDPVI" width="100" height="100" style="border-radius: 50%;" align="right" />
<div>

# URN Utility (`@jescrich/urn`)

[![Publish Package](https://github.com/jescrich/urn/actions/workflows/publish.yml/badge.svg)](https://github.com/jescrich/urn/actions/workflows/publish.yml) [![npm version](https://badge.fury.io/js/@jescrich%2Furn.svg)](https://badge.fury.io/js/@jescrich%2Furn)

Author: José Escrich https://joseescrich.com
</div>

</div>


## Overview
A powerful, extensible utility for working with **Uniform Resource Names (URNs)**.

This package allows you to **compose, validate, parse, transform, and manipulate URNs** efficiently. It supports attribute management, UUID generation, normalization, and extensibility for custom namespace validation.

- [Documentation](https://jescrich.github.io/libraries/docs/urn/intro)
- [Introduction to URNs](https://jescrich.github.io/libraries/docs/urn/why)
- [Usage on Mongo](https://jescrich.github.io/libraries/docs/urn/mongo)

## Installation

```sh
npm install @jescrich/urn
```

or using Yarn:

```sh
yarn add @jescrich/urn
```

## Usage

URNs follow the format:  
```txt
urn:<entity>:<id>[:<key>:<value>]*
```

### **Examples**
```txt
urn:customer:jescrich@sampledomain.com
urn:customer:6e8bc430-9c3a-11d9-9669-0800200c9a66
urn:order:12345:vendor:amazon:status:shipped
urn:document:abc123:type:pdf:author:john_doe
urn:isbn:0-486-27557-4
urn:uuid:6e8bc430-9c3a-11d9-9669-0800200c9a66
urn:nbn:de:bvb:19-146642
```

## API Reference

### **1. Create a URN with a UUID**
```ts
import { Urn } from "@jescrich/urn";

const urn = Urn.createUUID("order");
console.log(urn);
// Output: urn:order:550e8400-e29b-41d4-a716-446655440000
```

### **2. Compose a URN**
```ts
const urn = Urn.compose({ entity: "order", id: "12345", attributes: { vendor: "amazon", status: "shipped" } });
console.log(urn);
// Output: urn:order:12345:vendor:amazon:status:shipped
```

### **3. Parse a URN**
```ts
const parsed = Urn.parse("urn:document:abc123:type:pdf:author:john_doe");
console.log(parsed);
/* Output:
{
  entity: "document",
  id: "abc123",
  attributes: { type: "pdf", author: "john_doe" }
}
*/
```

### **4. Extract Information**
```ts
console.log(Urn.entity("urn:order:12345")); // Output: order
console.log(Urn.id("urn:order:12345")); // Output: 12345
console.log(Urn.value("urn:order:12345:vendor:amazon", "vendor")); // Output: amazon
```

### **5. Attribute Management**
```ts
// Add or update an attribute
const updatedUrn = Urn.addAttribute("urn:order:12345", "status", "shipped");
console.log(updatedUrn);
// Output: urn:order:12345:status:shipped

// Remove an attribute
const removedUrn = Urn.removeAttribute("urn:order:12345:status:shipped", "status");
console.log(removedUrn);
// Output: urn:order:12345
```

### **6. Validation**
```ts
console.log(Urn.isValid("urn:order:12345")); // Output: true
console.log(Urn.isValid("invalid-string")); // Output: false
```

### **7. Normalization**
```ts
console.log(Urn.normalize("URN:Order:12345:Vendor:Amazon"));
// Output: urn:order:12345:vendor:amazon
```

## URN Specifications
- **Globally Unique & Persistent:** URNs provide stable, location-independent identifiers.
- **Case-Insensitive Prefix & Namespace:** The `urn:` prefix and namespace identifiers are case-insensitive.
- **RFC Compliance:** Namespace identifiers should follow [IANA registered URNs](https://www.iana.org/assignments/urn-namespaces/urn-namespaces.xhtml).
- **Max Length:** URNs have a maximum length of **255 characters**.

## Roadmap & Extensibility Considerations
The future development of `@jescrich/urn` aims to further enhance its capabilities, including:

- **Namespace-Specific Validation:**
  - Allow registering custom validation rules per namespace.
  - Example: Enforce UUID format for `urn:uuid:<id>`.

- **Support for Query (`?+`, `?=`) and Fragment (`#`) Components:**
  - Extend parsing to handle optional query/fragment parts as per RFC 8141.
  
- **Object-Oriented Extension:**
  - Introduce an extensible `URN` class to support subclassing.
  
- **Typed Namespace Handling:**
  - Define stricter TypeScript types for common URN formats.
  
- **Improved Error Handling:**
  - Implement an `InvalidUrnError` custom class to provide more descriptive error reporting.

## License
This project is licensed under the **MIT License**.

