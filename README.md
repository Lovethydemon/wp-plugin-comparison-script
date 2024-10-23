# WordPress Plugin Environment Comparison Tool

This tool helps compare WordPress plugin configurations between staging and production environments, identifying differences in plugin versions, activation states, and presence across environments.

## Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/wp-plugin-compare.git
cd wp-plugin-compare
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Collect Plugin Data

#### For Production Environment:
```bash
# SSH into your production server
ssh user@production-server

# Navigate to WordPress directory
cd /path/to/wordpress

# Export plugin list
wp plugin list --format=tab > production-plugins.txt

# Copy the file contents locally
# Either use SCP:
exit
scp user@production-server:/path/to/wordpress/production-plugins.txt ./data/

# Or copy the content directly from terminal and paste into data/production-plugins.txt
```

#### For Staging Environment:
```bash
# SSH into your staging server
ssh user@staging-server

# Navigate to WordPress directory
cd /path/to/wordpress

# Export plugin list
wp plugin list --format=tab > staging-plugins.txt

# Copy the file contents locally
# Either use SCP:
exit
scp user@staging-server:/path/to/wordpress/staging-plugins.txt ./data/

# Or copy the content directly from terminal and paste into data/staging-plugins.txt
```

### 4. Directory Structure
Ensure your directory looks like this:
```
wp-plugin-compare/
├── package.json
├── README.md
├── src/
│   └── compare-plugins.js
└── data/
    ├── staging-plugins.txt
    └── production-plugins.txt
```

## Usage

Run the comparison:
```bash
npm run compare
```

The script will generate a comparison report showing:
1. Plugins active in production but missing/inactive in staging
2. Plugins active in staging but missing/inactive in production
3. Version mismatches between environments
4. Plugins unique to each environment

Results will be:
- Displayed in the console
- Saved to `comparison-results.txt`

## Example Output
```
=== WordPress Plugin Environment Comparison ===

1. ACTIVE IN PRODUCTION BUT MISSING/INACTIVE IN STAGING:
  - example-plugin (Production v1.2.3) - missing in staging
  
2. ACTIVE IN STAGING BUT INACTIVE/MISSING IN PRODUCTION:
  - test-plugin (Staging v2.0.0) - inactive in production

3. VERSION MISMATCHES (ACTIVE PLUGINS):
  - woocommerce:
    Production: 8.3.0
    Staging: 8.2.0

4. ENVIRONMENT-SPECIFIC PLUGINS:
Only in Production:
  - prod-only-plugin (active)

Only in Staging:
  - staging-only-plugin (inactive)
```

## Troubleshooting

### Common Issues

1. **Empty Comparison Results**
   - Verify plugin list files exist in data/ directory
   - Check file contents have correct tab-separated format
   - Ensure files have proper line endings

2. **File Not Found Errors**
   - Check directory structure
   - Verify file permissions
   - Ensure data/ directory exists

3. **Parse Errors**
   - Verify WP-CLI output format is tab-separated
   - Check for any manual modifications to plugin list files

### Gathering Fresh Data
If you need to update the plugin lists:

```bash
# Production
wp plugin list --format=tab > data/production-plugins.txt

# Staging
wp plugin list --format=tab > data/staging-plugins.txt
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
ISC

## Notes
- This tool assumes WP-CLI is available on your WordPress environments
- Plugin comparisons are case-insensitive
- Must-use plugins are included in the comparison
- Plugins with different names but same functionality might not be detected as the same plugin