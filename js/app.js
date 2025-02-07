function llmCompare() {
    return {
        models: [],
        selectedProvider: '',
        selectedMode: '',
        showOnlyVision: false,
        showAllModels: false,
        sortField: 'name',
        sortDirection: 'asc',
        suffix_whitelist: [],
        blacklist: [],

        async init() {
            // Import config
            const { config } = await import('./config.js');
            this.suffix_whitelist = config.model_whitelist;
            this.blacklist = config.model_blacklist;

            // Load model data
            const response = await fetch('model_prices_and_context_window.json');
            const data = await response.json();
            this.models = Object.entries(data)
                .filter(([key, value]) => key !== 'last_updated')  // Exclude last_updated from models
                .filter(([key, value]) => !this.blacklist.includes(key))
                .filter(([key, value]) => value.input_cost_per_token || value.output_cost_per_token)  // filter no price
                .map(([key, value]) => ({
                    name: key,
                    ...value,
                    provider: value.litellm_provider,
                    // Convert to price per million tokens
                    input_price_per_million: value.input_cost_per_token ? value.input_cost_per_token * 1000000 : null,
                    output_price_per_million: value.output_cost_per_token ? value.output_cost_per_token * 1000000 : null,
                    isWhitelisted: this.isModelWhitelisted(key)
                }));
            
            // Store last_updated separately
            this.models.last_updated = data.last_updated;
        },

        isModelWhitelisted(modelName) {
            const normalizedName = this.normalizeModelName(modelName);
            return this.suffix_whitelist.some(name => {
                return normalizedName === name;
            });
        },

        get providers() {
            return [...new Set(this.models.map(m => m.provider))].sort();
        },

        get modes() {
            return [...new Set(this.models.map(m => m.mode))].sort();
        },

        normalizeModelName(modelName) {
            // Get the part after the last '/'
            const lastPart = modelName.split('/').pop();
            
            // Split by '-' and '@' to handle different separators
            const parts = lastPart.split(/[-@]/);
            
            // Process parts from right to left
            let normalizedParts = [];
            const hardcodedKeywords = ['exp', 'experimental', 'preview'];
            
            for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i];
                
                // Skip if it's a hardcoded keyword
                if (hardcodedKeywords.includes(part.toLowerCase())) {
                    continue;
                }
                
                // Skip if it's a number sequence at the end
                // But keep numbers if they're in the middle (like claude-3-5-haiku)
                if (i === parts.length - 1 && /^\d+$/.test(part)) {
                    continue;
                }
                
                normalizedParts.unshift(part);
            }
            
            return normalizedParts.join('-');
        },

        get filteredModels() {
            const filtered = this.models
                .filter(model => {
                    if (!this.showAllModels && !model.isWhitelisted) return false;
                    if (this.selectedProvider && model.provider !== this.selectedProvider) return false;
                    if (this.selectedMode && model.mode !== this.selectedMode) return false;
                    if (this.showOnlyVision && !model.supports_vision) return false;
                    return true;
                });

            // Group models by their normalized name
            const groupedModels = filtered.reduce((acc, model) => {
                const normalizedName = this.normalizeModelName(model.name);
                if (!acc[normalizedName]) {
                    acc[normalizedName] = {
                        normalized_name: normalizedName,
                        variants: [],
                        mode: model.mode,
                    };
                }
                
                // Find a variant with the same prices
                const existingVariant = acc[normalizedName].variants.find(v => 
                    v.input_price_per_million === model.input_price_per_million &&
                    v.output_price_per_million === model.output_price_per_million
                );

                if (existingVariant) {
                    // Add the provider and model name to existing variant
                    if (!existingVariant.providers) existingVariant.providers = [existingVariant.provider];
                    if (!existingVariant.names) existingVariant.names = [existingVariant.name];
                    
                    if (!existingVariant.providers.includes(model.provider)) {
                        existingVariant.providers.push(model.provider);
                    }
                    existingVariant.names.push(model.name);
                } else {
                    // Create new variant
                    const variant = {...model};
                    variant.providers = [model.provider];
                    variant.names = [model.name];
                    acc[normalizedName].variants.push(variant);
                }
                return acc;
            }, {});

            // Convert grouped models to array and sort
            return Object.values(groupedModels)
                .sort((a, b) => {
                    if (this.sortField === 'name') {
                        const aVal = a.normalized_name;
                        const bVal = b.normalized_name;
                        return this.sortDirection === 'asc' ? 
                            aVal.localeCompare(bVal) : 
                            bVal.localeCompare(aVal);
                    }
                    
                    // For other fields, sort by the best (lowest for price, highest for others) value in the group
                    const aVal = this.getBestValueFromGroup(a.variants, this.sortField);
                    const bVal = this.getBestValueFromGroup(b.variants, this.sortField);
                    
                    // Handle null values in sorting
                    if (aVal === null) return 1;
                    if (bVal === null) return -1;
                    
                    // Compare values
                    if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
                    if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
                    return 0;
                });
        },

        getBestValueFromGroup(variants, field) {
            if (field === 'provider') return variants[0][field];
            if (field === 'mode') return variants[0][field];
            
            // For price fields, return the lowest/highest value based on sort direction
            if (field.includes('price')) {
                const values = variants
                    .map(v => v[field])
                    .filter(v => v !== null);
                
                if (values.length === 0) return null;
                
                // For prices, we always want to sort by lowest first
                return Math.min(...values);
            }
            
            return variants[0][field];
        },

        formatCost(cost) {
            if (!cost) return 'N/A';
            return `$${cost.toFixed(2)}`;
        },

        sort(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }
        },

        getSortIcon(field) {
            if (this.sortField !== field) return '↕️';
            return this.sortDirection === 'asc' ? '↑' : '↓';
        }
    }
} 