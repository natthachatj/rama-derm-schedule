import {useId} from 'react';
// The supplied PNG has a maximum alpha of 18/255; normalize opacity at display time.
export default function BrandLogo(){const filter='rama-alpha-'+useId().replace(/:/g,'');return <svg className="rama-logo" viewBox="50 410 980 280" role="img" aria-label="RAMA Dermatology, established 1968"><defs><filter id={filter} colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="14.166667"/></feComponentTransfer></filter></defs><image href="/rama-dermatology.png" width="1080" height="1080" filter={`url(#${filter})`}/></svg>}
