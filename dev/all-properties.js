// All the database and server properties known by the Management API.
// They have been retrieved using the following URLs resp.:
// 
// - http://xxx:8002/manage/v2/databases/xxx/properties?format=xml
// - http://xxx:8002/manage/v2/servers/xxx/properties?format=xml&group-id=Default
//
// then extracted using this XQuery expression:
//
// string-join(
//    for $elem in /*/* order by name($elem) return name($elem),
//    '&#10;')

"use strict";

(function() {

    // database properties
    var dbProps =
`assignment-policy
attribute-value-positions
collection-lexicon
data-encryption
database-backups
database-name
database-replication
default-rulesets
directory-creation
element-attribute-word-lexicons
element-value-positions
element-word-lexicons
element-word-positions
element-word-query-throughs
enabled
encryption-key-id
expunge-locks
fast-case-sensitive-searches
fast-diacritic-sensitive-searches
fast-element-character-searches
fast-element-phrase-searches
fast-element-trailing-wildcard-searches
fast-element-word-searches
fast-phrase-searches
fast-reverse-searches
field-value-positions
field-value-searches
fields
forests
format-compatibility
fragment-parents
fragment-roots
geospatial-element-attribute-pair-indexes
geospatial-element-child-indexes
geospatial-element-indexes
geospatial-element-pair-indexes
geospatial-path-indexes
geospatial-region-path-indexes
in-memory-geospatial-region-index-size
in-memory-limit
in-memory-list-size
in-memory-range-index-size
in-memory-reverse-index-size
in-memory-tree-size
in-memory-triple-index-size
index-detection
inherit-collections
inherit-permissions
inherit-quality
journal-count
journal-size
journaling
language
large-size-threshold
locking
maintain-directory-last-modified
maintain-last-modified
merge-blackouts
merge-max-size
merge-min-ratio
merge-min-size
merge-priority
merge-timestamp
one-character-searches
path-namespaces
phrase-arounds
phrase-throughs
positions-list-max-size
preallocate-journals
preload-mapped-data
preload-replica-mapped-data
range-element-attribute-indexes
range-element-indexes
range-field-indexes
range-index-optimize
range-path-indexes
rebalancer-enable
rebalancer-throttle
reindexer-enable
reindexer-throttle
reindexer-timestamp
retain-until-backup
retired-forest-count
schema-database
security-database
stemmed-searches
tf-normalization
three-character-searches
three-character-word-positions
trailing-wildcard-searches
trailing-wildcard-word-positions
triple-index
triple-positions
two-character-searches
uri-lexicon
word-lexicons
word-positions
word-searches`
.split('\n');

    // server properties
    var srvProps =
`address
authentication
backlog
collation
compute-content-length
concurrent-request-limit
content-database
coordinate-system
debug-allow
default-error-format
default-inference-size
default-time-limit
default-user
default-xquery-version
display-last-login
distribute-timestamps
enabled
error-handler
execute
external-securities
file-log-level
group-name
internal-security
keep-alive-timeout
log-errors
max-inference-size
max-time-limit
module-locations
multi-version-concurrency-control
namespaces
output-byte-order-mark
output-cdata-section-localname
output-cdata-section-namespace-uri
output-doctype-public
output-doctype-system
output-encoding
output-escape-uri-attributes
output-include-content-type
output-include-default-attributes
output-indent
output-indent-tabs
output-indent-untyped
output-media-type
output-method
output-normalization-form
output-omit-xml-declaration
output-sgml-character-entities
output-standalone
output-undeclare-prefixes
output-version
port
pre-commit-trigger-depth
pre-commit-trigger-limit
profile-allow
request-blackouts
request-timeout
rewrite-resolves-globally
root
schemas
server-name
server-type
session-timeout
ssl-allow-sslv3
ssl-allow-tls
ssl-ciphers
ssl-disable-sslv3
ssl-disable-tlsv1
ssl-disable-tlsv1-1
ssl-disable-tlsv1-2
ssl-hostname
ssl-require-client-certificate
static-expires
threads
url-rewriter
webDAV`
.split('\n');

    module.exports = {
	dbProps  : dbProps,
	srvProps : srvProps
    };
}
)();
