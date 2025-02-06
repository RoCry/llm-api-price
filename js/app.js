function llmCompare() {
    return {
        models: [],
        selectedProvider: '',
        selectedMode: '',
        showOnlyVision: false,
        showAllModels: false,
        sortField: 'name',
        sortDirection: 'asc',
        whitelist: [],

        async init() {
            // Import config
            const { config } = await import('./config.js');
            this.whitelist = config.model_suffix_whitelist;

            // Load model data
            const response = await fetch('model_prices_and_context_window.json');
            const data = await response.json();
            this.models = Object.entries(data)
                .filter(([key, value]) => key !== 'sample_spec')
                .map(([key, value]) => ({
                    name: key,
                    ...value,
                    provider: value.litellm_provider,
                    // Convert to price per million tokens
                    input_price_per_million: value.input_cost_per_token ? value.input_cost_per_token * 1000000 : null,
                    output_price_per_million: value.output_cost_per_token ? value.output_cost_per_token * 1000000 : null,
                    isWhitelisted: this.isModelWhitelisted(key)
                }));
        },

        isModelWhitelisted(modelName) {
            return this.whitelist.some(suffix => {
                // Get the part after the last '/' or the full string if no '/'
                const modelSuffix = modelName.split('/').pop();
                return modelSuffix === suffix;
            });
        },

        get providers() {
            return [...new Set(this.models.map(m => m.provider))].sort();
        },

        get modes() {
            return [...new Set(this.models.map(m => m.mode))].sort();
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

            // Group models by their suffix
            const groupedModels = filtered.reduce((acc, model) => {
                const suffix = model.name.split('/').pop();
                if (!acc[suffix]) {
                    acc[suffix] = {
                        suffix,
                        variants: [],
                        mode: model.mode, // All variants should have same mode
                    };
                }
                acc[suffix].variants.push(model);
                return acc;
            }, {});

            // Convert grouped models to array and sort
            return Object.values(groupedModels)
                .sort((a, b) => {
                    if (this.sortField === 'name') {
                        const aVal = a.suffix;
                        const bVal = b.suffix;
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
            
            // For price fields, return the lowest non-null value
            const values = variants
                .map(v => v[field])
                .filter(v => v !== null);
            return values.length > 0 ? Math.min(...values) : null;
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