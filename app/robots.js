import environment from '../lib/environment.cjs';
export default function robots(){return {rules:{userAgent:'*',...(environment.isTestingEnvironment()?{disallow:'/'}:{allow:'/',disallow:['/admin/','/campus-lab','/api/admin/']})}};}
