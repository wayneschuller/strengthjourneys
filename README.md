<!-- @format -->
# Strength Journeys
## https://www.strengthjourneys.xyz
### Interactive strength progress visualisations for barbell and other gym lifts
Strength Journeys is a free web app to visualize your barbell lifting data from Google Sheets. Strength progress tracking, one rep max calculator, gym timer and more. Fully open source. Chalk not included.

![image](https://user-images.githubusercontent.com/1592295/212287626-21d46619-5f57-4869-9a6d-384f7ac4bbcb.png)
![image](https://user-images.githubusercontent.com/1592295/212287995-7f3e6694-5aaa-4a68-bf08-e51c48936025.png)

### Google Sheet as data source
Requires user data in a Google Sheet. The app will ask for read-only access of your specific lifting spreadsheet. (this can be revoked at any time)

![sample_google_sheet_fuzzy_border](https://github.com/wayneschuller/strengthjourneys/assets/1592295/16f8f5c5-efa8-4a9b-93ab-2ef8f3af816e)

Open our [sample data format in Google Sheets](https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0). (Click File Menu, then click 'Make A Copy')

### Tech stack
- Javascript
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [chart.js](https://www.chartjs.org/) (via [react-chartjs-2](https://react-chartjs-2.js.org/))
- [Shadcn/ui](https://ui.shadcn.com/) components
- [NextAuth.js](https://next-auth.js.org/)
- Deployed to [Vercel](https://vercel.com/home)

See [package.json](https://github.com/wayneschuller/strengthjourneys/blob/main/package.json) for the full list of dependencies
 
### Deployment branch
The main git branch is deployed on Vercel. 
https://strengthjourneys-git-main-wayneschuller.vercel.app/  

This deployment has informative console logging of processing timings and any errors.


### Unites features from my previous projects:

- https://www.onerepmaxcalculator.xyz/
- https://wayneschuller.github.io/powerlifting_strength_tracker_js/e1rm.html

