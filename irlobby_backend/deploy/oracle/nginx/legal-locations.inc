# App Store legal pages. Include inside a server block that already sets
# `root /usr/share/nginx/html;` and defines `location @django`.
# Serves static HTML when present so Apple review crawlers do not need JS.

location = /privacy {
    try_files /privacy.html @django;
}

location = /privacy/ {
    try_files /privacy.html @django;
}

location = /privacy-policy {
    try_files /privacy.html @django;
}

location = /privacy-policy/ {
    try_files /privacy.html @django;
}

location = /terms {
    try_files /terms.html @django;
}

location = /terms/ {
    try_files /terms.html @django;
}

location = /support {
    try_files /support.html @django;
}

location = /support/ {
    try_files /support.html @django;
}
