import os
import sys
import webbrowser

try:
    import pandas as pd
except ImportError:
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror(
        "خطأ في التبعيات",
        "يرجى تثبيت مكتبة pandas لتشغيل التطبيق.\nيمكنك تثبيتها باستخدام:\npip install pandas"
    )
    sys.exit(1)

import plotly.express as px
import dash
from dash.dependencies import Input, Output

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        # When bundled by PyInstaller, resources are placed in _MEIPASS
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

FILE_NAME = "member informatiom (2).xlsx"
excel_path = get_resource_path(FILE_NAME)

if not os.path.exists(excel_path):
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("خطأ في البيانات", f"يرجى وضع ملف الإكسيل المسمى:\n{FILE_NAME}\nبجانب ملف البرنامج لكي يعمل.")
    sys.exit()

df = pd.read_excel(excel_path, sheet_name="Sheet1")

core_cols = [
    "الاسم العربي", "الموبايل", "الهاتف", "تاريخ الميلاد", 
    "الحالة الاجتماعية", "المؤهل", "اللائحة", "الرقم القومي", 
    "العنوان", "الوظيفة", "الجنسية", "المدينة", 
    "المحافظة", "الإيميل", "تاريخ التسجيل", "تاريخ الحجز"
]

df["missing_count"] = df[core_cols].isna().sum(axis=1)
empty_members = df[df["missing_count"] == 16].copy()
empty_members["حالة النقص"] = "عضوية فارغة تماماً (بدون اسم أو داتا)"

name_only_members = df[df["missing_count"] == 15].copy()
name_only_members["حالة النقص"] = "يوجد اسم فقط (بدون موبايل أو رقم قومي)"

df_missing = pd.concat([empty_members, name_only_members])
total_records = len(df)
total_missing = len(df_missing)
total_clean = total_records - total_missing

# Create Dash app
app = dash.Dash(__name__)
app.title = "داشبورد فحص العضويات"

app.layout = dash.html.Div(
    style={"direction": "rtl", "fontFamily": "Segoe UI, Tahoma", "backgroundColor": "#f4f6f9", "padding": "20px"},
    children=[
        dash.html.Div(
            style={"textAlign": "center", "backgroundColor": "#1e3d59", "color": "white", "padding": "20px", "borderRadius": "10px", "marginBottom": "25px"},
            children=[
                dash.html.H1("لوحة تحكم فحص وتحليل فجوات البيانات", style={"margin": "0 0 10px 0"}),
                dash.html.P(f"تحليل ملف: {FILE_NAME}", style={"margin": "0", "opacity": "0.8"}),
            ]
        ),
        dash.html.Div(
            style={"display": "flex", "justifyContent": "space-around", "gap": "15px", "marginBottom": "25px"},
            children=[
                dash.html.Div(style={"backgroundColor": "white", "padding": "20px", "borderRadius": "8px", "width": "30%", "textAlign": "center", "borderRight": "5px solid #1e3d59"},
                         children=[dash.html.H3("إجمالي الصفوف"), dash.html.H1(f"{total_records:,}")]),
                dash.html.Div(style={"backgroundColor": "white", "padding": "20px", "borderRadius": "8px", "width": "30%", "textAlign": "center", "borderRight": "5px solid #2ecc71"},
                         children=[dash.html.H3("عضويات مكتملة"), dash.html.H1(f"{total_clean:,}")]),
                dash.html.Div(style={"backgroundColor": "white", "padding": "20px", "borderRadius": "8px", "width": "30%", "textAlign": "center", "borderRight": "5px solid #e74c3c"},
                         children=[dash.html.H3("عضويات بها داتا ناقصة"), dash.html.H1(f"{total_missing:,}")]),
            ]
        ),
        dash.html.Div(
            style={"display": "flex", "justifyContent": "space-between", "gap": "20px", "marginBottom": "25px"},
            children=[
                dash.html.Div(style={"backgroundColor": "white", "padding": "15px", "borderRadius": "8px", "width": "48%"},
                         children=[dash.dcc.Graph(figure=px.pie(names=["بيانات مكتملة", "بيانات ناقصة"], values=[total_clean, total_missing], color_discrete_sequence=["#2ecc71", "#e74c3c"]))]),
                dash.html.Div(style={"backgroundColor": "white", "padding": "15px", "borderRadius": "8px", "width": "48%"},
                         children=[dash.dcc.Graph(figure=px.bar(x=["اسم فقط", "عضوية فارغة"], y=[len(name_only_members), len(empty_members)], color_discrete_sequence=["#f39c12"]))]),
            ]
        ),
        dash.html.Div(
            style={"backgroundColor": "white", "padding": "20px", "borderRadius": "8px"},
            children=[
                dash.html.H3("استخراج وفلترة أرقام العضويات الناقصة تفاعلياً"),
                dash.dcc.Dropdown(
                    id="status-filter",
                    options=[
                        {"label": "عرض الكل", "value": "ALL"},
                        {"label": "عضويات فارغة تماماً (17 عضوية)", "value": "عضوية فارغة تماماً (بدون اسم أو داتا)"},
                        {"label": "يوجد اسم فقط بدون تفاصيل (338 عضوية)", "value": "يوجد اسم فقط (بدون موبايل أو رقم قومي)"},
                    ],
                    value="ALL", clearable=False, style={"marginBottom": "20px"}
                ),
                dash.html.Div(id="table-container"),
            ]
        )
    ]
)

@app.callback(Output("table-container", "children"), [Input("status-filter", "value")])
def update_table(selected_status):
    filtered_df = df_missing if selected_status == "ALL" else df_missing[df_missing["حالة النقص"] == selected_status]
    display_df = filtered_df[["رقم العضوية", "الاسم العربي", "حالة النقص"]]
    return dash.html.Table(
        style={"width": "100%", "borderCollapse": "collapse", "textAlign": "center"},
        children=[
            dash.html.Thead(dash.html.Tr([dash.html.Th(col, style={"border": "1px solid #ddd", "padding": "12px", "backgroundColor": "#1e3d59", "color": "white"}) for col in ["رقم العضوية", "الاسم العربي", "المشكلة"]])),
            dash.html.Tbody([
                dash.html.Tr([
                    dash.html.Td(str(row["رقم العضوية"]), style={"border": "1px solid #ddd", "padding": "10px", "fontWeight": "bold"}),
                    dash.html.Td(row["الاسم العربي"] if pd.notna(row["الاسم العربي"]) else "--- فارغ ---", style={"border": "1px solid #ddd", "padding": "10px"}),
                    dash.html.Td(row["حالة النقص"], style={"border": "1px solid #ddd", "padding": "10px", "color": "#c0392b" if "تماماً" in row["حالة النقص"] else "#d35400"}),
                ]) for _, row in display_df.iterrows()
            ])
        ]
    )

if __name__ == "__main__":
    webbrowser.open_new("http://127.0.0.1:8050/")
    app.run_server(debug=False, port=8050)
    